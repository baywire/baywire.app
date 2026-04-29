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

export type HomeMobileView = "feed" | "plan";

function eventMapFromList(events: AppEvent[]): Map<string, AppEvent> {
  const m = new Map<string, AppEvent>();
  for (const e of events) m.set(e.id, e);
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
  togglePlan: (e: AppEvent) => void;
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
}: {
  children: ReactNode;
  defaultOpenPlan?: boolean;
  initialPlanOrder: string[];
  initialPlanEvents: AppEvent[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(() => defaultOpenPlan);
  const [mobileView, setMobileView] = useState<HomeMobileView>(() =>
    defaultOpenPlan ? "plan" : "feed",
  );
  const [planOrder, setPlanOrder] = useState(() => [...initialPlanOrder]);
  const [planEventsById, setPlanEventsById] = useState(() =>
    eventMapFromList(initialPlanEvents),
  );
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

  useEffect(() => {
    setPlanOrderCookie(planOrder);
  }, [planOrder]);

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
      togglePlan,
    }),
    [drawerOpen, mobileView, toggleDrawer, showFeed, showPlan, planOrder, planEventsById, togglePlan],
  );

  return <HomePlanContext.Provider value={value}>{children}</HomePlanContext.Provider>;
}
