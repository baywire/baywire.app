"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Event } from "@/generated/prisma/client";

import type { WindowKey } from "@/lib/time/window";

export interface HomeContextValue {
  events: Event[];
  savedFromServer: Event[];
  window: WindowKey;
  topTags: Set<string>;
  setTopTags: (next: Set<string>) => void;
  savedIds: Set<string>;
  toggleSaved: (event: Event) => void;
  filtered: Event[];
  planOrder: string[];
  togglePlan: (id: string) => void;
}

const HomeContext = createContext<HomeContextValue | null>(null);

export function useHome(): HomeContextValue {
  const v = useContext(HomeContext);
  if (!v) throw new Error("useHome must be used within HomeProvider");
  return v;
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
