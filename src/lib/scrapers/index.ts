import { dontTellComedyAdapter } from "./dontTellComedy";
import { dunedinGovAdapter } from "./dunedin";
import { eventbriteAdapter } from "./eventbrite";
import { feverupAdapter } from "./feverup";
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
import { unationAdapter } from "./unation";
import { visitStPeteAdapter } from "./visitStPete";
import { visitTampaBayAdapter } from "./visitTampaBay";

import type { SourceAdapter } from "./types";

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
  dunedinGovAdapter,
  unationAdapter,
  feverupAdapter,
] as const;

export function getAdapter(slug: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.slug === slug);
}

export type { SourceAdapter, ListingItem } from "./types";
