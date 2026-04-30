import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Browser, Page } from "playwright";

const HOST_LAST_HIT = new Map<string, number>();
const HOST_GAPS_MS = 1100;

let browser: Browser | null = null;

export async function acquireBrowser(): Promise<void> {
  if (browser) return;
  const { chromium } = await import("playwright");
  browser = await chromium.launch({
    headless: process.env.SCRAPE_HEADED !== "1",
  });
  console.log("[browser] launched chromium");
}

export async function releaseBrowser(): Promise<void> {
  if (!browser) return;
  await browser.close();
  browser = null;
  console.log("[browser] closed");
}

export function hasBrowser(): boolean {
  return browser !== null;
}

export interface BrowserFetchOptions {
  signal?: AbortSignal;
  label?: string;
  waitUntil?: "networkidle" | "domcontentloaded" | "load";
  waitForSelector?: string;
  timeoutMs?: number;
}

export interface BrowserFetchResult {
  html: string;
  finalUrl: string;
}

/**
 * Navigate a fresh Playwright page, wait for the content to settle (including
 * WAF challenge resolution), and return the fully-rendered HTML.
 *
 * Uses the same per-host pacing as politeFetch so we don't flood targets.
 */
export async function browserFetch(
  url: string,
  opts: BrowserFetchOptions = {},
): Promise<BrowserFetchResult> {
  if (!browser) throw new Error("Browser not launched — call acquireBrowser() first");

  const parsed = new URL(url);
  await paceHost(parsed.host);

  const timeout = opts.timeoutMs ?? 30_000;
  const startedAt = Date.now();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  let page: Page | null = null;
  try {
    page = await context.newPage();
    wireAbortSignal(page, opts.signal);

    await page.goto(url, {
      waitUntil: opts.waitUntil ?? "networkidle",
      timeout,
    });

    // Wait for WAF challenges to resolve; they typically redirect within a few seconds
    const maxChallengeWait = Math.min(timeout, 15_000);
    const deadline = Date.now() + maxChallengeWait;
    let html = await page.content();

    while (isChallengeOrBlock(html) === "waf_challenge" && Date.now() < deadline) {
      await page.waitForTimeout(2_000);
      html = await page.content();
    }

    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, {
        timeout: Math.max(timeout - (Date.now() - startedAt), 5_000),
      }).catch(() => {
        // Best-effort: selector may not appear if page structure changed
      });
      html = await page.content();
    }

    const finalUrl = page.url();
    const durationMs = Date.now() - startedAt;

    logBrowserFetch("log", parsed, durationMs, opts, `bytes=${html.length}`);
    await captureDebugBody(parsed.host, html);

    const status = isChallengeOrBlock(html);
    if (status !== "real_content") {
      logBrowserFetch("warn", parsed, durationMs, opts, `status=${status}`);
    }

    return { html, finalUrl };
  } finally {
    await context.close();
  }
}

/**
 * Navigate to a URL in a real browser purely to solve WAF challenges and
 * harvest the resulting cookies. Returns a `Cookie` header string suitable
 * for passing to politeFetch.
 */
export async function solveCookies(
  url: string,
  opts: Omit<BrowserFetchOptions, "waitForSelector"> = {},
): Promise<string | undefined> {
  if (!browser) throw new Error("Browser not launched — call acquireBrowser() first");

  const parsed = new URL(url);
  await paceHost(parsed.host);

  const timeout = opts.timeoutMs ?? 30_000;
  const startedAt = Date.now();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  try {
    const page = await context.newPage();
    wireAbortSignal(page, opts.signal);

    await page.goto(url, {
      waitUntil: opts.waitUntil ?? "networkidle",
      timeout,
    });

    // Wait for challenge to resolve
    const maxWait = Math.min(timeout, 15_000);
    const deadline = Date.now() + maxWait;
    let html = await page.content();

    while (isChallengeOrBlock(html) === "waf_challenge" && Date.now() < deadline) {
      await page.waitForTimeout(2_000);
      html = await page.content();
    }

    const cookies = await context.cookies(url);
    const durationMs = Date.now() - startedAt;

    if (cookies.length === 0) {
      logBrowserFetch("warn", parsed, durationMs, opts, "cookies=0");
      return undefined;
    }

    const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    logBrowserFetch("log", parsed, durationMs, opts, `cookies=${cookies.length}`);
    return header;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Challenge / WAF detection
// ---------------------------------------------------------------------------

type ChallengeStatus = "real_content" | "waf_challenge" | "captcha" | "block";

const WAF_CHALLENGE_PATTERNS = [
  /incapsula/i,
  /_incapsula_resource/i,
  /captcha-delivery\.com/i,
  /datadome/i,
  /cf-browser-verification/i,
  /cf_chl_opt/i,
  /challenges\.cloudflare\.com/i,
  /akamai.*bot.*manager/i,
  /g-recaptcha/i,
  /h-captcha/i,
];

const CAPTCHA_PATTERNS = [
  /g-recaptcha-response/i,
  /h-captcha-response/i,
  /captcha/i,
];

/**
 * Fast regex-based detection of WAF challenge / block pages.
 * Checks for known vendor signatures and structural clues.
 */
export function isChallengeOrBlock(html: string): ChallengeStatus {
  if (html.length < 500 && /<iframe/i.test(html)) return "waf_challenge";

  let challengeHits = 0;
  let captchaHits = 0;

  for (const pattern of WAF_CHALLENGE_PATTERNS) {
    if (pattern.test(html)) challengeHits++;
  }
  for (const pattern of CAPTCHA_PATTERNS) {
    if (pattern.test(html)) captchaHits++;
  }

  if (captchaHits >= 2) return "captcha";
  if (challengeHits >= 1) return "waf_challenge";

  // Very short HTML with no meaningful text is likely a block page
  if (html.length < 300) {
    const textOnly = html.replace(/<[^>]+>/g, "").trim();
    if (textOnly.length < 50) return "block";
  }

  return "real_content";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function paceHost(host: string): Promise<void> {
  const last = HOST_LAST_HIT.get(host) ?? 0;
  const wait = HOST_GAPS_MS - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  HOST_LAST_HIT.set(host, Date.now());
}

function wireAbortSignal(page: Page, signal?: AbortSignal): void {
  if (!signal) return;
  if (signal.aborted) {
    void page.close();
    return;
  }
  signal.addEventListener("abort", () => void page.close(), { once: true });
}

function logBrowserFetch(
  level: "log" | "warn",
  parsed: URL,
  durationMs: number,
  opts: BrowserFetchOptions,
  extra?: string,
): void {
  const fields = [
    "[fetch:browser]",
    `host=${parsed.host}`,
    `path=${parsed.pathname}${parsed.search}`,
    `ms=${durationMs}`,
  ];
  if (opts.label) fields.push(`label=${opts.label}`);
  if (extra) fields.push(extra);
  console[level](fields.join(" "));
}

const DEBUG_DIR = join(process.cwd(), "scripts", ".last-html");
let debugDirReady: Promise<void> | null = null;

function debugEnabled(): boolean {
  return process.env.SCRAPE_DEBUG === "1";
}

async function captureDebugBody(host: string, body: string): Promise<void> {
  if (!debugEnabled()) return;
  try {
    if (!debugDirReady) {
      debugDirReady = mkdir(DEBUG_DIR, { recursive: true }).then(() => undefined);
    }
    await debugDirReady;
    const safe = host.replace(/[^a-zA-Z0-9._-]+/g, "_");
    await writeFile(join(DEBUG_DIR, `${safe}.browser.html`), body, "utf8");
  } catch {
    // Best-effort
  }
}
