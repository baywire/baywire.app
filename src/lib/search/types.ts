import type { AppEvent } from "@/lib/events/types";
import type { AppPlace } from "@/lib/places/types";

export type SearchMode = "idle" | "loading" | "ai" | "fallback" | "error";

export interface SearchMetadata {
  mode: SearchMode;
  latencyMs: number;
  aiUsed: boolean;
}

export interface AIPick {
  type: "event" | "place";
  event?: AppEvent;
  place?: AppPlace;
  reason?: string;
}

export interface SearchResponse {
  query: string;
  intentLine: string | null;
  aiPicks: AIPick[];
  events: AppEvent[];
  places: AppPlace[];
  reasonByID: Record<string, string>;
  metadata: SearchMetadata;
}
