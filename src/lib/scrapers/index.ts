import { eventbriteAdapter } from "./eventbrite";
import { dontTellComedyAdapter } from "./dontTellComedy";
import { funnyBoneTampaAdapter } from "./funnyBoneTampa";
import { iLoveTheBurgAdapter } from "./iLoveTheBurg";
import { safetyHarborAdapter } from "./safetyHarbor";
import { sideSplittersAdapter } from "./sideSplitters";
import { strazCenterAdapter } from "./strazCenter";
import { tampaBayMarketsAdapter } from "./tampaBayMarkets";
import { tampaBayTimesAdapter } from "./tampaBayTimes";
import { tampaGovAdapter } from "./tampaGov";
import { tampaTheatreLiveAdapter } from "./tampaTheatreLive";
import { thatsSoTampaAdapter } from "./thatsSoTampa";
import { ticketmasterAdapter } from "./ticketmaster";
import { visitStPeteAdapter } from "./visitStPete";
import { visitTampaBayAdapter } from "./visitTampaBay";

import type { SourceAdapter } from "./types";

// Deferred sources, kept here as documentation:
//   - dunedin.gov     — Akamai 403 on direct HTML; no public ICS / RSS feed
//                       exposed by their JS-rendered calendar widget.
//   - unation.com     — Cloudflare bot challenge on listings; no public
//                       JSON-LD sitemap discovered.
//   - feverup.com     — JS SPA with no static event JSON-LD or sitemap.
// Re-enable any of these by adding an adapter whose `tryStructured` returns
// real data for at least one event detail page; HTML+LLM fallback is fine if
// the structured surface only covers some pages. We explicitly do NOT add
// Playwright/headless browsers (see plan).
export const ADAPTERS: readonly SourceAdapter[] = [
  eventbriteAdapter,
  ticketmasterAdapter,
  visitTampaBayAdapter,
  visitStPeteAdapter,
  tampaBayTimesAdapter,
  tampaBayMarketsAdapter,
  tampaGovAdapter,
  safetyHarborAdapter,
  iLoveTheBurgAdapter,
  thatsSoTampaAdapter,
  sideSplittersAdapter,
  dontTellComedyAdapter,
  funnyBoneTampaAdapter,
  strazCenterAdapter,
  tampaTheatreLiveAdapter,
] as const;

export function getAdapter(slug: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.slug === slug);
}

export type { SourceAdapter, ListingItem } from "./types";
