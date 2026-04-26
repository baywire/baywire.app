import pLimit from "p-limit";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "X-Aggregator": "baywire/0.1 (+https://baywire.app)",
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
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Fetches a URL with realistic browser-like headers, per-host pacing, and
 * exponential backoff on retryable failures.
 */
export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<string> {
  const parsed = new URL(url);
  const limit = limiterFor(parsed.host);
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  return limit(async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await paceHost(parsed.host);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const composite = composeSignal(ctrl.signal, opts.signal);
      try {
        const res = await fetch(url, {
          headers: { ...DEFAULT_HEADERS, ...opts.headers },
          redirect: "follow",
          signal: composite,
        });
        if (!res.ok) {
          if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw new Error(`HTTP ${res.status} for ${url}`);
        }
        return await res.text();
      } catch (err) {
        lastError = err;
        if (attempt === retries) break;
        if (err instanceof DOMException && err.name === "AbortError" && opts.signal?.aborted) {
          throw err;
        }
        await sleep(500 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  });
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
