"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { SegmentedList, SegmentedTab } from "@/design-system";

import type { WindowKey } from "@/lib/time/window";

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: "tonight", label: "Tonight" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
];

export function WindowToggle({
  selected,
  savedCount,
  showSavedOnly,
  onExitSavedMode,
  onToggleSaved,
}: {
  selected: WindowKey;
  savedCount: number;
  showSavedOnly: boolean;
  onExitSavedMode: () => void;
  onToggleSaved: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const savedViewActive = showSavedOnly && savedCount > 0;
  const timeViewActive = !savedViewActive;

  function setWindow(value: WindowKey) {
    onExitSavedMode();
    const next = new URLSearchParams(params);
    next.set("window", value);
    startTransition(() => router.push(`/?${next.toString()}`));
  }

  return (
    <SegmentedList
      role="tablist"
      aria-label="Time window and saved"
      className="flex w-full max-w-2xl flex-wrap justify-center gap-1 p-1.5 sm:inline-flex sm:w-auto sm:max-w-none sm:flex-nowrap sm:gap-0 sm:p-1"
    >
      {WINDOW_OPTIONS.map((opt) => {
        const active = timeViewActive && selected === opt.key;
        return (
          <SegmentedTab
            key={opt.key}
            role="tab"
            aria-selected={active}
            active={active}
            pending={pending}
            onClick={() => setWindow(opt.key)}
          >
            {opt.label}
          </SegmentedTab>
        );
      })}
      <SegmentedTab
        role="tab"
        aria-selected={savedViewActive}
        active={savedViewActive}
        pending={pending}
        disabled={savedCount === 0}
        title={savedCount === 0 ? "No saved events in this time window" : undefined}
        onClick={onToggleSaved}
        className="tabular-nums disabled:cursor-not-allowed disabled:opacity-40"
      >
        Saved ({savedCount})
      </SegmentedTab>
    </SegmentedList>
  );
}
