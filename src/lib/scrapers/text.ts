/**
 * Shared text-sanitization helpers for scraper output.
 *
 * Every event field that ultimately renders in the UI (title, description,
 * venueName, address) flows through this module so that we have a single
 * place handling HTML entity decoding, tag stripping, and whitespace
 * normalization. Source-specific adapters used to each carry a partial
 * subset of this logic and inevitably missed cases — most visibly,
 * WordPress titles arriving as `Pete&#8217;s Bagels` because the Tribe
 * Events title path skipped the entity table the description path used.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  sbquo: "\u201a",
  bdquo: "\u201e",
  laquo: "\u00ab",
  raquo: "\u00bb",
  lsaquo: "\u2039",
  rsaquo: "\u203a",
  middot: "\u00b7",
  bull: "\u2022",
  deg: "\u00b0",
  plusmn: "\u00b1",
  times: "\u00d7",
  divide: "\u00f7",
  sect: "\u00a7",
  para: "\u00b6",
  iexcl: "\u00a1",
  iquest: "\u00bf",
  cent: "\u00a2",
  pound: "\u00a3",
  euro: "\u20ac",
  yen: "\u00a5",
};

const NUMERIC_ENTITY_RE = /&#(x[0-9a-f]+|[0-9]+);/gi;
const NAMED_ENTITY_RE = /&([a-z][a-z0-9]+);/gi;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/g;
const ZERO_WIDTH_RE = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const BREAK_TAG_RE = /<\s*br\s*\/?\s*>/gi;
const BLOCK_CLOSE_TAG_RE = /<\/\s*(?:p|div|li|h[1-6]|blockquote|tr)\s*>/gi;

/**
 * Decodes named and numeric HTML entities (&amp;, &#8217;, &#x2019;) into
 * their Unicode characters. Unknown named entities are left intact.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  return input
    .replace(NUMERIC_ENTITY_RE, (full, raw: string) => {
      const lc = raw.toLowerCase();
      const code = lc.startsWith("x")
        ? Number.parseInt(lc.slice(1), 16)
        : Number.parseInt(lc, 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return full;
      try {
        return String.fromCodePoint(code);
      } catch {
        return full;
      }
    })
    .replace(NAMED_ENTITY_RE, (full, name: string) => {
      const value = NAMED_ENTITIES[name.toLowerCase()];
      return value ?? full;
    });
}

/**
 * Single-line cleanup for short fields like titles, venue names, and
 * addresses: decodes entities, strips zero-width / control characters,
 * collapses whitespace runs (including newlines and NBSP) to a single
 * space, and trims.
 */
export function cleanInlineText(input: string | null | undefined): string {
  if (!input) return "";
  return decodeHtmlEntities(String(input))
    .replace(ZERO_WIDTH_RE, "")
    .replace(CONTROL_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts CMS-rendered HTML (e.g. WordPress descriptions) into clean
 * plain text. Preserves paragraph breaks, decodes entities, and normalizes
 * inline whitespace.
 */
export function stripHtmlToText(input: string | null | undefined): string {
  if (!input) return "";
  const stripped = String(input)
    .replace(BREAK_TAG_RE, "\n")
    .replace(BLOCK_CLOSE_TAG_RE, "\n\n")
    .replace(HTML_TAG_RE, "");
  return decodeHtmlEntities(stripped)
    .replace(ZERO_WIDTH_RE, "")
    .replace(CONTROL_RE, (ch) => (ch === "\n" || ch === "\t" ? ch : ""))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
