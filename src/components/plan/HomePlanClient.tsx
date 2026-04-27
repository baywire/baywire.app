"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { ListOrdered, Radio, Search } from "lucide-react";

import { PlanView } from "@/components/plan/PlanView";
import { HomePlanProvider, useHomePlan } from "@/components/plan/homePlanContext";
import { SearchDialog } from "@/components/search/SearchDialog";
import { useHomeOptional } from "@/components/home/homeState";

import type { AppEvent } from "@/lib/events/types";

import { cn } from "@/lib/utils";

export function HomeWithPlanLayout({ children }: { children: ReactNode }) {
  const { drawerOpen, mobileView, showFeed } = useHomePlan();

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      <HomePlanHeaderBar />
      <SearchDialog />

      <div className="relative flex w-full min-w-0 flex-1 flex-col md:flex-row">
        <div
          className={cn(
            "w-full min-w-0 max-w-7xl flex-1 px-4 pb-20 sm:px-5 md:pb-0",
            mobileView === "plan" && "max-md:hidden",
          )}
        >
          {children}
        </div>

        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col border-ink-200/80 bg-sand-50/98 dark:border-ink-700/80 dark:bg-ink-900/98",
            "md:shrink-0 md:overflow-hidden md:border-l md:transition-[width,box-shadow] md:duration-300 md:ease-out",
            drawerOpen
              ? "md:sticky md:top-14 md:z-10 md:self-start md:h-[calc(100dvh-3.5rem)] md:min-h-0 md:w-88 md:shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.1)] dark:md:shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.35)]"
              : "md:h-0 md:max-h-0 md:min-h-0 md:w-0 md:overflow-hidden md:border-0",
            "max-md:fixed max-md:bottom-16 max-md:left-0 max-md:right-0 max-md:top-14 max-md:z-30 max-md:h-auto max-md:max-h-none max-md:border-t max-md:shadow-2xl",
            mobileView === "feed" && "max-md:translate-x-full max-md:pointer-events-none",
            "transition-transform duration-300 ease-out max-md:will-change-transform",
          )}
          aria-label="My plan"
        >
          <div
            className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden md:w-88 md:shrink-0"
          >
            <div className="shrink-0 border-b border-ink-200/70 px-4 py-2.5 dark:border-ink-700/70 md:py-3">
              <h2 className="font-display text-base font-semibold text-ink-900 md:text-lg dark:text-sand-50">
                My plan
              </h2>
              <p className="mt-0.5 hidden text-[11px] text-ink-500 dark:text-ink-300 sm:block sm:text-xs">
                Reorder, check overlaps — saved 7 days in this browser.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 pb-2 sm:px-3 sm:py-2">
              <PlanView onBrowseEvents={showFeed} />
            </div>
          </div>
        </aside>
      </div>

      <HomeMobilePlanTabs />
    </div>
  );
}

function HomePlanHeaderBar() {
  const { toggleDrawer, showPlan, showFeed, drawerOpen, mobileView } = useHomePlan();
  const home = useHomeOptional();

  const onPlanClick = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      toggleDrawer();
    } else {
      if (mobileView === "plan") {
        showFeed();
      } else {
        showPlan();
      }
    }
  }, [mobileView, showFeed, showPlan, toggleDrawer]);

  const planIsActive = drawerOpen || mobileView === "plan";

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-ink-100/60 bg-sand-50/90 backdrop-blur-md dark:border-ink-700/60 dark:bg-ink-900/85">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-5">
        <Link
          href="/"
          onClick={() => showFeed()}
          className="group flex min-w-0 items-center gap-2 font-display text-lg font-semibold tracking-tight"
          aria-label="Baywire — Tampa Bay events"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sunset-400 to-gulf-400 text-white shadow-sm transition group-hover:rotate-6">
            <Radio className="size-4" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="inline">
              Bay
              <span className="text-gulf-500 dark:text-gulf-200">wire</span>
            </span>
            <span className="ml-1.5 hidden align-middle text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400 sm:ml-2 sm:inline dark:text-ink-300">
              Tampa Bay
            </span>
          </span>
        </Link>
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => home?.openSearch()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-500 transition hover:bg-ink-100/80 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/80 dark:hover:text-sand-50"
            aria-label="Search events"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="max-sm:sr-only">Search</span>
          </button>
          <button
            type="button"
            onClick={onPlanClick}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
              planIsActive
                ? "bg-gulf-200 text-ink-900 dark:bg-gulf-600 dark:text-sand-50"
                : "text-ink-500 hover:bg-ink-100/80 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/80 dark:hover:text-sand-50",
            )}
            aria-pressed={planIsActive}
            aria-label="My plan"
          >
            <ListOrdered className="size-4 shrink-0" aria-hidden />
            <span className="max-sm:sr-only">My plan</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function HomeMobilePlanTabs() {
  const { mobileView, setMobileView } = useHomePlan();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-ink-200/80 bg-sand-50/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-ink-700/80 dark:bg-ink-900/95 md:hidden"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => setMobileView("feed")}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
            mobileView === "feed"
              ? "bg-ink-900 text-sand-50 shadow-sm dark:bg-sand-50 dark:text-ink-900"
              : "text-ink-500 hover:bg-ink-100/80 dark:hover:bg-ink-800/80",
          )}
        >
          Events
        </button>
        <button
          type="button"
          onClick={() => setMobileView("plan")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition",
            mobileView === "plan"
              ? "bg-ink-900 text-sand-50 shadow-sm dark:bg-sand-50 dark:text-ink-900"
              : "text-ink-500 hover:bg-ink-100/80 dark:hover:bg-ink-800/80",
          )}
        >
          <ListOrdered className="size-4" />
          My plan
        </button>
      </div>
    </div>
  );
}

export function HomePlanClient({
  orderIds: initialOrderIds,
  planEvents: initialPlanEvents,
  defaultOpenFromQuery,
  children,
}: {
  orderIds: string[];
  planEvents: AppEvent[];
  defaultOpenFromQuery: boolean;
  children: ReactNode;
}) {
  return (
    <HomePlanProvider
      defaultOpenPlan={defaultOpenFromQuery}
      initialPlanOrder={initialOrderIds}
      initialPlanEvents={initialPlanEvents}
    >
      {children}
    </HomePlanProvider>
  );
}
