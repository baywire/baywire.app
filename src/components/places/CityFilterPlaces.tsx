"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";

import { SegmentedList, SegmentedTab } from "@/design-system";
import { CITIES, type CityKey } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface CityFilterPlacesProps {
  selected: CityKey | "all";
  facets?: Record<string, number>;
}

export function CityFilterPlaces({ selected, facets }: CityFilterPlacesProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setCity(value: CityKey | "all") {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("city");
    else next.set("city", value);
    startTransition(() => router.push(`/places?${next.toString()}`));
  }

  const visibleCities = CITIES.filter((city) => {
    if (selected === city.key) return true;
    if (!facets) return true;
    return (facets[city.key] ?? 0) > 0;
  });

  const selectedLabel = selected === "all"
    ? "All cities"
    : CITIES.find((c) => c.key === selected)?.label ?? "All cities";

  return (
    <>
      {/* Mobile: styled dropdown */}
      <div className={cn("relative sm:hidden", pending && "opacity-60")}>
        <select
          value={selected}
          onChange={(e) => setCity(e.target.value as CityKey | "all")}
          className="appearance-none rounded-full border border-ink-200 bg-white/80 py-2 pl-4 pr-9 text-sm font-medium text-ink-900 shadow-sm backdrop-blur transition focus:border-gulf-400 focus:ring-2 focus:ring-gulf-200 focus:outline-none dark:border-ink-700 dark:bg-ink-900/60 dark:text-sand-50 dark:focus:border-gulf-400 dark:focus:ring-gulf-600"
        >
          <option value="all">All cities</option>
          {visibleCities.map((city) => (
            <option key={city.key} value={city.key}>
              {city.label}{facets?.[city.key] != null ? ` (${facets[city.key]})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      </div>

      {/* Desktop: segmented tabs */}
      <SegmentedList
        role="tablist"
        aria-label="Filter by city"
        className="hidden sm:inline-flex sm:w-auto sm:max-w-none sm:flex-nowrap sm:gap-0 sm:p-1"
      >
        <SegmentedTab
          role="tab"
          aria-selected={selected === "all"}
          active={selected === "all"}
          pending={pending}
          onClick={() => setCity("all")}
        >
          All cities
        </SegmentedTab>
        {visibleCities.map((city) => (
          <SegmentedTab
            key={city.key}
            role="tab"
            aria-selected={selected === city.key}
            active={selected === city.key}
            pending={pending}
            onClick={() => setCity(city.key)}
          >
            {city.label}
          </SegmentedTab>
        ))}
      </SegmentedList>
    </>
  );
}
