"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { setPlanOrderCookie } from "@/lib/cookies/browser";
import { insertChronologically } from "@/lib/plan/order";

import type { AppEvent } from "@/lib/events/types";
import type { AppPlace } from "@/lib/places/types";
import type { SearchMode, SearchResponse } from "@/lib/search/types";

export type HomeMobileView = "feed" | "places" | "plan";

function eventMapFromList(events: AppEvent[]): Map<string, AppEvent> {
  const m = new Map<string, AppEvent>();
  for (const e of events) m.set(e.id, e);
  return m;
}

function placeMapFromList(places: AppPlace[]): Map<string, AppPlace> {
  const m = new Map<string, AppPlace>();
  for (const p of places) m.set(p.id, p);
  return m;
}

export interface HomePlanContextValue {
  /** md+: slide-in from right, pushes main content. */
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  toggleDrawer: () => void;
  /** max-md: full-screen switch between events feed and plan. */
  mobileView: HomeMobileView;
  setMobileView: (v: HomeMobileView) => void;
  showFeed: () => void;
  showPlan: () => void;
  planOrder: string[];
  setPlanOrder: (next: string[] | ((p: string[]) => string[])) => void;
  planEventsById: ReadonlyMap<string, AppEvent>;
  planPlacesById: ReadonlyMap<string, AppPlace>;
  togglePlan: (e: AppEvent) => void;
  togglePlacePlan: (place: AppPlace) => void;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  searchResponse: SearchResponse | null;
  setSearchResponse: (response: SearchResponse | null) => void;
}

const HomePlanContext = createContext<HomePlanContextValue | null>(null);

export function useHomePlan(): HomePlanContextValue {
  const v = useContext(HomePlanContext);
  if (!v) {
    throw new Error("useHomePlan must be used within HomePlanProvider");
  }
  return v;
}

export function useHomePlanOptional(): HomePlanContextValue | null {
  return useContext(HomePlanContext);
}

export function HomePlanProvider({
  children,
  defaultOpenPlan = false,
  initialPlanOrder,
  initialPlanEvents,
  initialPlanPlaces = [],
}: {
  children: ReactNode;
  defaultOpenPlan?: boolean;
  initialPlanOrder: string[];
  initialPlanEvents: AppEvent[];
  initialPlanPlaces?: AppPlace[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(() => defaultOpenPlan);
  const [mobileView, setMobileView] = useState<HomeMobileView>(() =>
    defaultOpenPlan ? "plan" : "feed",
  );
  const [planOrder, setPlanOrder] = useState(() => [...initialPlanOrder]);
  const [planEventsById, setPlanEventsById] = useState(() =>
    eventMapFromList(initialPlanEvents),
  );
  const [planPlacesById, setPlanPlacesById] = useState(() =>
    placeMapFromList(initialPlanPlaces),
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("idle");
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const eventsRef = useRef(planEventsById);
  useEffect(() => {
    eventsRef.current = planEventsById;
  }, [planEventsById]);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((d) => !d);
  }, []);

  const showFeed = useCallback(() => {
    setMobileView("feed");
  }, []);

  const showPlan = useCallback(() => {
    setMobileView("plan");
  }, []);

  const togglePlan = useCallback((e: AppEvent) => {
    setPlanEventsById((m) => {
      const n = new Map(m);
      n.set(e.id, e);
      return n;
    });
    setPlanOrder((prev) => {
      if (prev.includes(e.id)) return prev.filter((x) => x !== e.id);
      const withNew = new Map(eventsRef.current);
      withNew.set(e.id, e);
      return insertChronologically(prev, e, withNew);
    });
  }, []);

  const togglePlacePlan = useCallback((place: AppPlace) => {
    setPlanPlacesById((m) => {
      const n = new Map(m);
      n.set(place.id, place);
      return n;
    });
    setPlanOrder((prev) => {
      if (prev.includes(place.id)) return prev.filter((x) => x !== place.id);
      if (prev.length >= 80) return prev;
      return [...prev, place.id];
    });
  }, []);

  useEffect(() => {
    setPlanOrderCookie(planOrder);
  }, [planOrder]);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const value = useMemo<HomePlanContextValue>(
    () => ({
      drawerOpen,
      setDrawerOpen,
      toggleDrawer,
      mobileView,
      setMobileView,
      showFeed,
      showPlan,
      planOrder,
      setPlanOrder,
      planEventsById,
      planPlacesById,
      togglePlan,
      togglePlacePlan,
      isSearchOpen,
      openSearch,
      closeSearch,
      searchQuery,
      setSearchQuery,
      searchMode,
      setSearchMode,
      searchResponse,
      setSearchResponse,
    }),
    [drawerOpen, mobileView, toggleDrawer, showFeed, showPlan, planOrder, planEventsById, planPlacesById, togglePlan, togglePlacePlan, isSearchOpen, openSearch, closeSearch, searchQuery, searchMode, searchResponse],
  );

  return <HomePlanContext.Provider value={value}>{children}</HomePlanContext.Provider>;
}
