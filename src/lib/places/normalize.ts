/**
 * Normalization utilities for place data. Applied both during initial
 * ingestion and retroactive reconciliation.
 */

// ── Phone numbers ──────────────────────────────────────────────────────

const DIGITS_ONLY = /[^\d]/g;

/**
 * Normalizes a phone number to (xxx) xxx-xxxx for US numbers.
 * Returns null for invalid/unrecoverable input.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(DIGITS_ONLY, "");
  if (digits.length === 0) return null;

  // 10-digit US number
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 11-digit with leading 1 (US country code)
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // Already looks formatted and has reasonable length — pass through cleaned
  if (digits.length >= 7 && digits.length <= 15) {
    return raw.trim();
  }

  return null;
}

// ── Hours ──────────────────────────────────────────────────────────────

const DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DAY_ALIASES: Record<string, string> = {
  monday: "Mon", mon: "Mon", mo: "Mon",
  tuesday: "Tue", tue: "Tue", tu: "Tue", tues: "Tue",
  wednesday: "Wed", wed: "Wed", we: "Wed",
  thursday: "Thu", thu: "Thu", th: "Thu", thur: "Thu", thurs: "Thu",
  friday: "Fri", fri: "Fri", fr: "Fri",
  saturday: "Sat", sat: "Sat", sa: "Sat",
  sunday: "Sun", sun: "Sun", su: "Sun",
};

const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/gi;

/**
 * Normalizes hours JSON from the wild into a consistent array format.
 * Standardizes day names, time formats, and merges redundant entries.
 *
 * Input: ["Monday-Friday: 11:00 AM - 10:00 PM", "Saturday 10AM-11PM"]
 * Output: ["Mon-Fri 11:00am-10:00pm", "Sat 10:00am-11:00pm"]
 */
export function normalizeHours(raw: unknown): string[] | null {
  if (!raw) return null;
  if (!Array.isArray(raw)) return null;

  const normalized: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const clean = normalizeHourEntry(entry.trim());
    if (clean) normalized.push(clean);
  }

  return normalized.length > 0 ? normalized : null;
}

function normalizeHourEntry(entry: string): string | null {
  // Normalize day names
  let result = entry;
  for (const [alias, short] of Object.entries(DAY_ALIASES)) {
    const re = new RegExp(`\\b${alias}\\b`, "gi");
    result = result.replace(re, short);
  }

  // Normalize times to lowercase am/pm with consistent format
  result = result.replace(TIME_RE, (_match, hour: string, min: string | undefined, period: string | undefined) => {
    const h = hour.padStart(1, "0");
    const m = min ?? "00";
    const p = period ? period.replace(/\./g, "").toLowerCase() : "";
    return `${h}:${m}${p}`;
  });

  // Clean up separators
  result = result
    .replace(/\s*[-–—]\s*/g, "-")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Remove "Closed" or empty entries
  if (/^\s*closed\s*$/i.test(result)) return null;

  return result || null;
}

/**
 * Validates that a URL looks like a plausible image URL.
 * Filters out tracking pixels, logos that are too generic, etc.
 */
export function isPlausibleImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.pathname.length < 5) return false;
    // Filter obvious non-images
    if (/\.(svg|ico|gif)$/i.test(u.pathname)) return false;
    // Filter tracking pixels
    if (/1x1|pixel|tracking|beacon/i.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates lat/lng are within valid ranges and specifically within
 * a reasonable bounding box for Tampa Bay area (with generous margins).
 */
export function isValidTampaBayCoords(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // Tampa Bay bounding box with ~50mi margins
  return lat >= 26.5 && lat <= 29.0 && lng >= -83.5 && lng <= -81.5;
}
