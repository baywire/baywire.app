"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { FilterChip } from "@/components/ui";

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
    <div className="w-full px-0">
      <div
        className="flex w-full min-w-0 flex-wrap justify-center gap-2"
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
    <FilterChip
      type="button"
      role="tab"
      tone="ink"
      selected={active}
      aria-selected={active}
      onClick={onClick}
      className={cn(pending && "opacity-60")}
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
    </FilterChip>
  );
}

function sumFacets(facets: Record<string, number>): number {
  let total = 0;
  for (const k of Object.keys(facets)) {
    if (isCityKey(k)) total += facets[k];
  }
  return total;
}
