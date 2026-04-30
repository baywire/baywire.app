"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AppEvent } from "@/lib/events/types";
import type { CityKey } from "@/lib/cities";

import type { WindowKey } from "@/lib/time/window";

export interface HomeContextValue {
  events: AppEvent[];
  savedFromServer: AppEvent[];
  window: WindowKey;
  selectedCity: CityKey | "all";
  freeOnly: boolean;
  topTags: Set<string>;
  setTopTags: (next: Set<string>) => void;
  savedIds: Set<string>;
  /** Upcoming saved events in current window+tag view (for counts). */
  upcomingSavedCount: number;
  /** Upcoming saved with start in the next 24 hours. */
  savedStartingWithin24hCount: number;
  toggleSaved: (event: AppEvent) => void;
  showSavedOnly: boolean;
  setShowSavedOnly: (v: boolean) => void;
  filtered: AppEvent[];
  planOrder: string[];
  togglePlan: (event: AppEvent) => void;
}

const HomeContext = createContext<HomeContextValue | null>(null);

export function useHome(): HomeContextValue {
  const v = useContext(HomeContext);
  if (!v) throw new Error("useHome must be used within HomeProvider");
  return v;
}

export function useHomeOptional(): HomeContextValue | null {
  return useContext(HomeContext);
}

export function HomeStateProvider({
  value,
  children,
}: {
  value: HomeContextValue;
  children: ReactNode;
}) {
  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}
