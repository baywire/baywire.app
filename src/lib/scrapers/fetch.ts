import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pLimit from "p-limit";

// Chrome 132 on Linux. Paired with the matching `sec-ch-ua` client hints so
// WAFs that fingerprint the header set (Cloudflare, Akamai, Imperva) see a
// coherent navigation rather than an obvious scripted client. We deliberately
// do NOT include any `X-*` aggregator-identifying header — those are an
// instant tell.
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Linux"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Priority: "u=0, i",
};

/** Per-host concurrency limiter (1 in flight, ~1 req/s on average). */
const HOST_LIMITS = new Map<string, ReturnType<typeof pLimit>>();
const HOST_GAPS_MS = 1100;
const HOST_LAST_HIT = new Map<string, number>();

function limiterFor(host: string): ReturnType<typeof pLimit> {
  let limit = HOST_LIMITS.get(host);
  if (!limit) {
    limit = pLimit(1);
    HOST_LIMITS.set(host, limit);
  }
  return limit;
}

async function paceHost(host: string): Promise<void> {
  const last = HOST_LAST_HIT.get(host) ?? 0;
  const now = Date.now();
  const wait = HOST_GAPS_MS - (now - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  HOST_LAST_HIT.set(host, Date.now());
}

export interface FetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Number of retry attempts on retryable failures. Default 2. */
  retries?: number;
  /** Per-attempt timeout in milliseconds. Default 15s. */
  timeoutMs?: number;
  /** Optional Referer header. Helps with Cloudflare/Akamai heuristics. */
  referer?: string;
  /** Free-form label included in logs (e.g. `eventbrite:list`). */
  label?: string;
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const DEBUG_DIR = join(process.cwd(), "scripts", ".last-html");
const DEBUG_DIR_READY = new Map<string, Promise<void>>();

function debugEnabled(): boolean {
  return process.env.SCRAPE_DEBUG === "1";
}

async function ensureDebugDir(): Promise<void> {
  let pending = DEBUG_DIR_READY.get(DEBUG_DIR);
  if (!pending) {
    pending = mkdir(DEBUG_DIR, { recursive: true }).then(() => undefined);
    DEBUG_DIR_READY.set(DEBUG_DIR, pending);
  }
  await pending;
}

async function captureBody(host: string, status: number, body: string): Promise<void> {
  if (!debugEnabled()) return;
  try {
    await ensureDebugDir();
    const safe = host.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const file = join(DEBUG_DIR, `${safe}.${status}.html`);
    await writeFile(file, body, "utf8");
  } catch {
    // Debug capture is best-effort; never fail the scrape over it.
  }
}

function previewBody(body: string): string {
  return body
    .slice(0, 240)
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
}

function logFetch(
  level: "log" | "warn",
  parsed: URL,
  status: number,
  durationMs: number,
  opts: FetchOptions,
  extra?: string,
): void {
  const fields = [
    `[fetch]`,
    `host=${parsed.host}`,
    `path=${parsed.pathname}${parsed.search}`,
    `status=${status}`,
    `ms=${durationMs}`,
  ];
  if (opts.label) fields.push(`label=${opts.label}`);
  if (opts.referer) fields.push(`referer=${shortUrl(opts.referer)}`);
  if (extra) fields.push(extra);
  console[level](fields.join(" "));
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Fetches a URL with realistic browser-like headers, per-host pacing, and
 * exponential backoff on retryable failures. Emits a structured `[fetch]`
 * log line for every attempt (status + duration); on non-OK responses also
 * logs a body preview so anti-bot WAFs are easy to identify in CI logs.
 * When `SCRAPE_DEBUG=1`, full response bodies are written to
 * `scripts/.last-html/<host>.<status>.html` for offline diagnosis.
 */
export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<string> {
  const parsed = new URL(url);
  const limit = limiterFor(parsed.host);
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  const referer = opts.referer;
  const baseHeaders: Record<string, string> = referer
    ? {
        ...DEFAULT_HEADERS,
        Referer: referer,
        "Sec-Fetch-Site": sameSite(referer, parsed) ? "same-origin" : "cross-site",
      }
    : { ...DEFAULT_HEADERS };

  return limit(async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await paceHost(parsed.host);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const composite = composeSignal(ctrl.signal, opts.signal);
      const startedAt = Date.now();
      try {
        const res = await fetch(url, {
          headers: { ...baseHeaders, ...opts.headers },
          redirect: "follow",
          signal: composite,
        });
        const durationMs = Date.now() - startedAt;

        if (!res.ok) {
          if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
            logFetch("warn", parsed, res.status, durationMs, opts, "retry=true");
            await sleep(500 * 2 ** attempt);
            continue;
          }
          const body = await res.text().catch(() => "");
          await captureBody(parsed.host, res.status, body);
          logFetch(
            "warn",
            parsed,
            res.status,
            durationMs,
            opts,
            `bodyPreview="${previewBody(body)}"`,
          );
          throw new Error(`HTTP ${res.status} for ${url}`);
        }

        const body = await res.text();
        const totalMs = Date.now() - startedAt;
        if (debugEnabled()) await captureBody(parsed.host, res.status, body);
        logFetch("log", parsed, res.status, totalMs, opts, `bytes=${body.length}`);
        return body;
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === "AbortError" && opts.signal?.aborted) {
          throw err;
        }
        if (attempt === retries) {
          if (!(err instanceof Error && /^HTTP /.test(err.message))) {
            console.warn(
              `[fetch] host=${parsed.host} path=${parsed.pathname} status=ERR ms=${
                Date.now() - startedAt
              }${opts.label ? ` label=${opts.label}` : ""} error="${
                err instanceof Error ? err.message : String(err)
              }"`,
            );
          }
          break;
        }
        await sleep(500 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  });
}

function sameSite(referer: string, target: URL): boolean {
  try {
    const r = new URL(referer);
    return r.host === target.host;
  } catch {
    return false;
  }
}

function composeSignal(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  return ctrl.signal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
