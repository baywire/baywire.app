import * as cheerio from "cheerio";

import { politeFetch } from "./fetch";
import { reduceHtml } from "./reduce";
import type { ListingItem, SourceAdapter } from "./types";

const ORIGIN = "https://cityofsafetyharbor.com";
const FEED_URL = `${ORIGIN}/RSSFeed.aspx?ModID=58&CID=All-calendar.xml`;
const EID_RE = /[?&]EID=(\d+)/i;

interface RssItem {
  eid: string;
  title: string;
  url: string;
  /** Plain-text RSS description (date / time / location facts). */
  hint: string;
}

/**
 * City of Safety Harbor (CivicPlus). The /Calendar.aspx UI is JS-rendered,
 * but the platform also publishes a public RSS feed at
 * /RSSFeed.aspx?ModID=58&CID=All-calendar.xml that lists every upcoming
 * event with title, date, time, location, and a /Calendar.aspx?EID={id}
 * detail-page link. Detail pages are server-rendered, so we feed both the
 * RSS facts (as a metadata header) and the reduced detail HTML to the LLM.
 *
 * Stays on the LLM path: the RSS description carries date/time/location as
 * free-form prose, not structured fields, and CivicPlus does not advertise an
 * iCal feed for this calendar. Once a reliable structured surface exists we
 * can add a `tryStructured` slot.
 */
export const safetyHarborAdapter: SourceAdapter = {
  slug: "safety_harbor",
  label: "Safety Harbor Calendar",
  baseUrl: ORIGIN,

  async listEvents({ signal }) {
    const xml = await politeFetch(FEED_URL, {
      signal,
      label: "safety_harbor:rss",
    });
    const items = parseFeed(xml);
    cache.clear();
    const out: ListingItem[] = [];
    for (const it of items) {
      cache.set(it.eid, it);
      out.push({ sourceEventId: it.eid, url: it.url, hint: it.hint });
    }
    return out;
  },

  async fetchAndReduce(item, signal) {
    const html = await politeFetch(item.url, {
      signal,
      referer: ORIGIN,
      label: "safety_harbor:detail",
    });
    const detail = reduceHtml(html, item.url);
    const meta = cache.get(item.sourceEventId);
    const header = meta
      ? `RSS metadata:\nTitle: ${meta.title}\n${meta.hint}\n\n`
      : "";
    return {
      reducedHtml: `${header}${detail}`,
      canonicalUrl: item.url,
    };
  },
};

const cache = new Map<string, RssItem>();

function parseFeed(xml: string): RssItem[] {
  const $ = cheerio.load(xml, { xml: true });
  const out = new Map<string, RssItem>();

  $("item").each((_, el) => {
    const item = $(el);
    const link = item.find("link").first().text().trim();
    const eidMatch = EID_RE.exec(link);
    if (!eidMatch) return;
    const eid = eidMatch[1];
    if (out.has(eid)) return;

    const title = item.find("title").first().text().trim();
    const description = decodeEntities(item.find("description").first().text());
    const hint = formatHint(description);

    out.set(eid, {
      eid,
      title,
      url: `${ORIGIN}/Calendar.aspx?EID=${eid}`,
      hint,
    });
  });

  return Array.from(out.values());
}

function formatHint(htmlDescription: string): string {
  const text = htmlDescription
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/?strong>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(input: string): string {
  let out = input;
  for (const [k, v] of Object.entries(ENTITIES)) out = out.split(k).join(v);
  return out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
