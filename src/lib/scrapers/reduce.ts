import * as cheerio from "cheerio";

const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "footer",
  "header form",
  "form",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "link",
  "meta",
];

const KEEP_ATTRS = new Set([
  "src",
  "href",
  "alt",
  "title",
  "datetime",
  "content",
  "itemprop",
  "itemtype",
  "property",
]);

const MAIN_SELECTORS = [
  "main article",
  "article",
  "main",
  "[role='main']",
  "#content",
  ".content",
];

const MAX_REDUCED_LENGTH = 16_000;

/**
 * Strips an HTML document down to the readable event content. JSON-LD blocks
 * are extracted up front (event structured data) and prepended to the reduced
 * output so the LLM gets the high-signal data first.
 */
export function reduceHtml(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);

  const jsonLdBlobs: string[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).text().trim();
    if (txt && txt.length < 4_000 && /event/i.test(txt)) {
      jsonLdBlobs.push(txt);
    }
  });

  const ogTags: string[] = [];
  $("meta[property^='og:'], meta[name^='twitter:'], meta[itemprop]").each((_, el) => {
    const key = $(el).attr("property") ?? $(el).attr("name") ?? $(el).attr("itemprop");
    const val = $(el).attr("content");
    if (key && val) ogTags.push(`${key}: ${val}`);
  });

  for (const sel of STRIP_SELECTORS) $(sel).remove();
  $("*").contents().each((_, node) => {
    if (node.type === "comment") $(node).remove();
  });

  let root: ReturnType<typeof $> = $("body");
  for (const sel of MAIN_SELECTORS) {
    const found = $(sel).first();
    if (found.length) {
      root = found;
      break;
    }
  }

  root.find("*").each((_, node) => {
    if (node.type !== "tag") return;
    const el = node as { attribs: Record<string, string> };
    const attribs = el.attribs;
    for (const name of Object.keys(attribs)) {
      if (!KEEP_ATTRS.has(name)) delete attribs[name];
    }
    if (attribs.src) attribs.src = absolutize(attribs.src, baseUrl);
    if (attribs.href) attribs.href = absolutize(attribs.href, baseUrl);
  });

  const text = root
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const jsonLdSection = jsonLdBlobs.length
    ? `JSON-LD:\n${jsonLdBlobs.join("\n---\n")}\n\n`
    : "";
  const ogSection = ogTags.length ? `MetaTags:\n${ogTags.join("\n")}\n\n` : "";

  const reduced = `${jsonLdSection}${ogSection}Text:\n${text}`;
  return reduced.length > MAX_REDUCED_LENGTH
    ? `${reduced.slice(0, MAX_REDUCED_LENGTH)}\n…[truncated]`
    : reduced;
}

function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}
