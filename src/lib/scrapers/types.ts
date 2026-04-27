import type { ExtractedEvent } from "@/lib/extract/schema";

export interface ListingItem {
  /** Stable per-source identifier. Falls back to the URL when unknown. */
  sourceEventId: string;
  url: string;
  /** Optional hint passed straight through to the LLM as additional context. */
  hint?: string;
}

/**
 * Result of a successful structured-data short-circuit. Adapters that can
 * parse fully-typed event data (JSON-LD / ICS / a vendor JSON API) skip the
 * LLM by returning this directly.
 */
export interface StructuredEvent {
  event: ExtractedEvent;
  /** Canonical event URL. Defaults to `item.url` when omitted. */
  canonicalUrl?: string;
  /**
   * Override the content hash used for dedupe. Defaults to a hash of the
   * canonical JSON serialization of `event` (see pipeline). Provide one when
   * you want stability across irrelevant fields (e.g. ordering).
   */
  contentHash?: string;
}

export interface SourceAdapter {
  slug: string;
  label: string;
  baseUrl: string;
  /** Lists candidate event URLs for the given window. */
  listEvents(args: {
    windowStart: Date;
    windowEnd: Date;
    signal?: AbortSignal;
  }): Promise<ListingItem[]>;
  /**
   * Optional fast path. When provided, the pipeline calls this before the
   * HTML fetch + LLM extraction. Returning a `StructuredEvent` skips the LLM
   * entirely; returning `null` falls through to `fetchAndReduce`.
   */
  tryStructured?(
    item: ListingItem,
    signal?: AbortSignal,
  ): Promise<StructuredEvent | null>;
  /** Fetches & reduces a single event detail page to clean text/HTML. */
  fetchAndReduce(item: ListingItem, signal?: AbortSignal): Promise<{
    reducedHtml: string;
    canonicalUrl: string;
  }>;
}
