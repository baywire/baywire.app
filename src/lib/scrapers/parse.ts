import * as cheerio from "cheerio";

/**
 * Loads HTML using cheerio's `htmlparser2` backend instead of the default
 * `parse5`. Several real-world scraper targets (Simpleview-built tourism
 * sites, syndicated newsroom CMSes) emit markup that parse5 silently bails on
 * mid-document, dropping the bulk of `<a>` nodes from the resulting DOM.
 * `htmlparser2` is more permissive and processes the full document.
 *
 * `_useHtmlParser2` is a documented runtime option but absent from cheerio's
 * public type definitions, so we widen the options type for this call site.
 */
export function loadHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html, { _useHtmlParser2: true } as cheerio.CheerioOptions);
}
