"use client";

import { useState } from "react";

import { ListOrdered } from "lucide-react";

import { getPlanOrderFromBrowser, setPlanOrderCookie } from "@/lib/cookies/browser";
import { appendOrMoveToEnd } from "@/lib/plan/order";
import { cn } from "@/lib/utils";

export function AddToPlanButton({
  eventId,
  initialInPlan,
}: {
  eventId: string;
  initialInPlan: boolean;
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
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gulf-400",
        inPlan
          ? "border-gulf-500 bg-gulf-50 text-ink-900 dark:border-gulf-400 dark:bg-gulf-800/50 dark:text-sand-50"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 dark:border-ink-600 dark:bg-ink-900/60 dark:text-ink-200",
      )}
      aria-pressed={inPlan}
    >
      <ListOrdered className="size-4" />
      {inPlan ? "In My plan" : "Add to My plan"}
    </button>
  );
}
