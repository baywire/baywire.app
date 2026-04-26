"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { CITIES, isCityKey, type CityKey } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface CityFilterProps {
  selected: CityKey | "all";
  facets?: Record<string, number>;
}

export function CityFilter({ selected, facets }: CityFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setCity(value: CityKey | "all") {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("city");
    else next.set("city", value);
    startTransition(() => router.push(`/?${next.toString()}`));
  }

  return (
    <div className="scroll-shadow -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-x-visible md:px-0">
      <div
        className="flex w-max min-w-0 max-md:flex-nowrap max-md:gap-2 md:w-full md:flex-wrap md:justify-center md:gap-2 md:pb-0"
        role="tablist"
        aria-label="Filter by city"
      >
        <Pill
          active={selected === "all"}
          pending={pending && selected !== "all"}
          onClick={() => setCity("all")}
          count={facets ? sumFacets(facets) : undefined}
        >
          All
        </Pill>
        {CITIES.map((city) => (
          <Pill
            key={city.key}
            active={selected === city.key}
            pending={pending && selected !== city.key}
            onClick={() => setCity(city.key)}
            count={facets?.[city.key]}
          >
            {city.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}

interface PillProps {
  children: React.ReactNode;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  count?: number;
}

function Pill({ children, active, pending, onClick, count }: PillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gulf-400",
        active
          ? "border-ink-900 bg-ink-900 text-sand-50 shadow-sm dark:border-sand-50 dark:bg-sand-50 dark:text-ink-900"
          : "border-ink-200 bg-white/70 text-ink-700 backdrop-blur hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900/60 dark:text-sand-100",
        pending && "opacity-60",
      )}
    >
      <span>{children}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
            active ? "bg-white/15" : "bg-ink-100 dark:bg-ink-700",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function sumFacets(facets: Record<string, number>): number {
  let total = 0;
  for (const k of Object.keys(facets)) {
    if (isCityKey(k)) total += facets[k];
  }
  return total;
}
