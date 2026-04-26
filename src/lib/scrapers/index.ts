import { eventbriteAdapter } from "./eventbrite";
import { iLoveTheBurgAdapter } from "./iLoveTheBurg";
import { safetyHarborAdapter } from "./safetyHarbor";
import { tampaBayMarketsAdapter } from "./tampaBayMarkets";
import { tampaBayTimesAdapter } from "./tampaBayTimes";
import { tampaGovAdapter } from "./tampaGov";
import { thatsSoTampaAdapter } from "./thatsSoTampa";
import { visitStPeteAdapter } from "./visitStPete";
import { visitTampaBayAdapter } from "./visitTampaBay";

import type { SourceAdapter } from "./types";

// TODO(phase-2, headless browser): the following sources require a real
// browser to extract event listings — feverup.com (JS SPA), unation.com
// (Cloudflare bot challenge), and dunedin.gov (Akamai 403). Add a
// Playwright-backed fetcher and re-enable these here.
export const ADAPTERS: readonly SourceAdapter[] = [
  eventbriteAdapter,
  visitTampaBayAdapter,
  visitStPeteAdapter,
  tampaBayTimesAdapter,
  tampaBayMarketsAdapter,
  tampaGovAdapter,
  safetyHarborAdapter,
  iLoveTheBurgAdapter,
  thatsSoTampaAdapter,
] as const;

export function getAdapter(slug: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.slug === slug);
}

export type { SourceAdapter, ListingItem } from "./types";
