export interface ListingItem {
  /** Stable per-source identifier. Falls back to the URL when unknown. */
  sourceEventId: string;
  url: string;
  /** Optional hint passed straight through to the LLM as additional context. */
  hint?: string;
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
  /** Fetches & reduces a single event detail page to clean text/HTML. */
  fetchAndReduce(item: ListingItem, signal?: AbortSignal): Promise<{
    reducedHtml: string;
    canonicalUrl: string;
  }>;
}
