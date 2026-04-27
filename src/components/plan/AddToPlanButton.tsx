"use client";

import { useCallback, useState } from "react";

import { ListOrdered } from "lucide-react";

import { useHomePlanOptional } from "@/components/plan/homePlanContext";
import { getPlanOrderFromBrowser, setPlanOrderCookie } from "@/lib/cookies/browser";
import { appendOrMoveToEnd } from "@/lib/plan/order";
import { cn } from "@/lib/utils";

import type { AppEvent } from "@/lib/events/types";

export function AddToPlanButton({
  event,
  initialInPlan,
  surface = "default",
  className: classNameProp,
}: {
  event: AppEvent;
  initialInPlan: boolean;
  /** `onDark` = event dialog header (ink background). */
  surface?: "default" | "onDark";
  className?: string;
}) {
  const homePlan = useHomePlanOptional();
  const [standaloneInPlan, setStandaloneInPlan] = useState(initialInPlan);

  const inPlan = homePlan
    ? homePlan.planOrder.includes(event.id)
    : standaloneInPlan;

  const toggle = useCallback(() => {
    if (homePlan) {
      homePlan.togglePlan(event);
      return;
    }
    const cur = getPlanOrderFromBrowser();
    if (cur.includes(event.id)) {
      const n = cur.filter((x) => x !== event.id);
      setPlanOrderCookie(n);
      setStandaloneInPlan(false);
    } else {
      if (cur.length >= 80) return;
      const n = appendOrMoveToEnd(cur, event.id);
      setPlanOrderCookie(n);
      setStandaloneInPlan(true);
    }
  }, [event, homePlan]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border text-sm font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        surface === "onDark"
          ? inPlan
            ? "h-10 border-gulf-300/80 bg-gulf-500/20 px-3.5 text-sand-50 hover:bg-gulf-500/30 focus-visible:outline-gulf-200 sm:h-9 sm:px-3"
            : "h-10 border-white/30 bg-white/5 px-3.5 text-sand-100 hover:border-white/50 hover:bg-white/10 focus-visible:outline-sand-200 sm:h-9 sm:px-3"
          : inPlan
            ? "border-gulf-500 bg-gulf-50 px-4 py-2 text-ink-900 focus-visible:outline-gulf-400 dark:border-gulf-300 dark:bg-gulf-700 dark:text-white"
            : "border-ink-200 bg-white px-4 py-2 text-ink-700 hover:border-ink-300 focus-visible:outline-gulf-400 dark:border-ink-600 dark:bg-ink-900/60 dark:text-ink-200",
        classNameProp,
      )}
      aria-pressed={inPlan}
    >
      <ListOrdered className="size-4" />
      {inPlan ? "In My plan" : "Add to My plan"}
    </button>
  );
}
