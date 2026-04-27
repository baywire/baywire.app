export type SearchMode = "idle" | "loading" | "ai" | "fallback" | "error";

export interface SearchMetadata {
  mode: SearchMode;
  latencyMs: number;
  aiUsed: boolean;
  truncatedCandidates: boolean;
}

export interface SearchResponse {
  query: string;
  intentLine: string | null;
  aiPickIDs: string[];
  directMatchIDs: string[];
  reasonByID: Record<string, string>;
  metadata: SearchMetadata;
}
