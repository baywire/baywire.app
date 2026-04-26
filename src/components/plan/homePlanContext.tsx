"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type HomeMobileView = "feed" | "plan";

interface HomePlanContextValue {
  /** md+: slide-in from right, pushes main content. */
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  toggleDrawer: () => void;
  /** max-md: full-screen switch between events feed and plan. */
  mobileView: HomeMobileView;
  setMobileView: (v: HomeMobileView) => void;
  showFeed: () => void;
  showPlan: () => void;
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
}: {
  children: ReactNode;
  defaultOpenPlan?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(() => defaultOpenPlan);
  const [mobileView, setMobileView] = useState<HomeMobileView>(() =>
    defaultOpenPlan ? "plan" : "feed",
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

  const value = useMemo<HomePlanContextValue>(
    () => ({
      drawerOpen,
      setDrawerOpen,
      toggleDrawer,
      mobileView,
      setMobileView,
      showFeed,
      showPlan,
    }),
    [drawerOpen, mobileView, toggleDrawer, showFeed, showPlan],
  );

  return <HomePlanContext.Provider value={value}>{children}</HomePlanContext.Provider>;
}
