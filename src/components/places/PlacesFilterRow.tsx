"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { CityFilterPlaces } from "@/components/places/CityFilterPlaces";
import { FilterChip } from "@/design-system";
import { usePlaces } from "@/components/places/PlacesProvider";

import type { CityKey } from "@/lib/cities";
import type { PlaceCategoryValue } from "@/lib/places/types";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: { key: PlaceCategoryValue | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "restaurant", label: "Restaurants" },
  { key: "brewery", label: "Breweries" },
  { key: "bar", label: "Bars" },
  { key: "cafe", label: "Cafés" },
  { key: "bakery", label: "Bakeries" },
  { key: "museum", label: "Museums" },
  { key: "gallery", label: "Galleries" },
  { key: "park", label: "Parks" },
  { key: "beach", label: "Beaches" },
  { key: "shop", label: "Shops" },
  { key: "venue", label: "Venues" },
  { key: "attraction", label: "Attractions" },
];

interface PlacesFilterRowProps {
  selected: CityKey | "all";
  facets: Record<string, number>;
}

export function PlacesFilterRow({ selected, facets }: PlacesFilterRowProps) {
  const { category, setCategory } = usePlaces();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setCategoryAndNav(value: PlaceCategoryValue | "all") {
    setCategory(value);
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("category");
    else next.set("category", value);
    startTransition(() => router.push(`/places?${next.toString()}`));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3">
      <CityFilterPlaces selected={selected} facets={facets} />
      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Place category">
        {CATEGORY_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.key}
            type="button"
            role="tab"
            tone="ink"
            selected={category === opt.key}
            aria-selected={category === opt.key}
            onClick={() => setCategoryAndNav(opt.key)}
            className={cn(pending && "opacity-60")}
          >
            {opt.label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
