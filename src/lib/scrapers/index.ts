import { eventbriteAdapter } from "./eventbrite";
import { tampaBayTimesAdapter } from "./tampaBayTimes";
import { visitStPeteAdapter } from "./visitStPete";
import { visitTampaBayAdapter } from "./visitTampaBay";

import type { SourceAdapter } from "./types";

export const ADAPTERS: readonly SourceAdapter[] = [
  eventbriteAdapter,
  visitTampaBayAdapter,
  visitStPeteAdapter,
  tampaBayTimesAdapter,
] as const;

export function getAdapter(slug: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.slug === slug);
}

export type { SourceAdapter, ListingItem } from "./types";
