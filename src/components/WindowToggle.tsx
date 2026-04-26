"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import type { WindowKey } from "@/lib/time/window";

const OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: "tonight", label: "Tonight" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
];

export function WindowToggle({ selected }: { selected: WindowKey }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setWindow(value: WindowKey) {
    const next = new URLSearchParams(params);
    next.set("window", value);
    startTransition(() => router.push(`/?${next.toString()}`));
  }

  return (
    <div
      role="tablist"
      aria-label="Time window"
      className="inline-flex items-center rounded-full border border-ink-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-ink-700 dark:bg-ink-900/60"
    >
      {OPTIONS.map((opt) => {
        const active = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setWindow(opt.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gulf-400",
              active
                ? "bg-ink-900 text-sand-50 dark:bg-sand-50 dark:text-ink-900"
                : "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50",
              pending && !active && "opacity-60",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
