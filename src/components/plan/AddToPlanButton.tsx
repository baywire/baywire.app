"use client";

import { useState } from "react";

import { ListOrdered } from "lucide-react";

import { getPlanOrderFromBrowser, setPlanOrderCookie } from "@/lib/cookies/browser";
import { appendOrMoveToEnd } from "@/lib/plan/order";
import { cn } from "@/lib/utils";

export function AddToPlanButton({
  eventId,
  initialInPlan,
  surface = "default",
  className: classNameProp,
}: {
  eventId: string;
  initialInPlan: boolean;
  /** `onDark` = event dialog header (ink background). */
  surface?: "default" | "onDark";
  className?: string;
}) {
  const [inPlan, setInPlan] = useState(initialInPlan);

  function toggle() {
    const cur = getPlanOrderFromBrowser();
    if (cur.includes(eventId)) {
      const n = cur.filter((x) => x !== eventId);
      setPlanOrderCookie(n);
      setInPlan(false);
    } else {
      if (!cur.includes(eventId) && cur.length >= 80) return;
      const n = appendOrMoveToEnd(cur, eventId);
      setPlanOrderCookie(n);
      setInPlan(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        surface === "onDark"
          ? inPlan
            ? "border-gulf-300/80 bg-gulf-500/20 px-3 py-1.5 text-xs text-sand-50 hover:bg-gulf-500/30 focus-visible:outline-gulf-200 sm:text-sm"
            : "border-white/30 bg-white/5 px-3 py-1.5 text-xs text-sand-100 hover:border-white/50 hover:bg-white/10 focus-visible:outline-sand-200 sm:text-sm"
          : inPlan
            ? "border-gulf-500 bg-gulf-50 px-4 py-2 text-sm text-ink-900 focus-visible:outline-gulf-400 dark:border-gulf-400 dark:bg-gulf-800 dark:text-sand-50"
            : "border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 hover:border-ink-300 focus-visible:outline-gulf-400 dark:border-ink-600 dark:bg-ink-900/60 dark:text-ink-200",
        classNameProp,
      )}
      aria-pressed={inPlan}
    >
      <ListOrdered className="size-3.5 sm:size-4" />
      {inPlan ? "In My plan" : "Add to My plan"}
    </button>
  );
}
