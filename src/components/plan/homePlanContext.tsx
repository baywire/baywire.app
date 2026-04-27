"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setPlanOrderCookie } from "@/lib/cookies/browser";
import { appendOrMoveToEnd } from "@/lib/plan/order";

import type { Event } from "@/generated/prisma/client";

export type HomeMobileView = "feed" | "plan";

function eventMapFromList(events: Event[]): Map<string, Event> {
  const m = new Map<string, Event>();
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
  planEventsById: ReadonlyMap<string, Event>;
  togglePlan: (e: Event) => void;
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
  initialPlanEvents: Event[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(() => defaultOpenPlan);
  const [mobileView, setMobileView] = useState<HomeMobileView>(() =>
    defaultOpenPlan ? "plan" : "feed",
  );
  const [planOrder, setPlanOrder] = useState(() => [...initialPlanOrder]);
  const [planEventsById, setPlanEventsById] = useState(() =>
    eventMapFromList(initialPlanEvents),
  );

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((d) => !d);
  }, []);

  const showFeed = useCallback(() => {
    setMobileView("feed");
  }, []);

  const showPlan = useCallback(() => {
    setMobileView("plan");
  }, []);

  const togglePlan = useCallback((e: Event) => {
    setPlanOrder((prev) => {
      if (prev.includes(e.id)) return prev.filter((x) => x !== e.id);
      return appendOrMoveToEnd(prev, e.id);
    });
    setPlanEventsById((m) => {
      const n = new Map(m);
      n.set(e.id, e);
      return n;
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
