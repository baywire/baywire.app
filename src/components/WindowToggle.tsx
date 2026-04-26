"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { SegmentedList, SegmentedTab } from "@/components/ui";

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
    <SegmentedList role="tablist" aria-label="Time window">
      {OPTIONS.map((opt) => {
        const active = selected === opt.key;
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
    </SegmentedList>
  );
}
