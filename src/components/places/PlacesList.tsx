"use client";

import { useMemo } from "react";

import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { usePlaces } from "@/components/places/PlacesProvider";
import { Button } from "@/components/ui";

import type { AppPlace } from "@/lib/places/types";

const STANDOUT_MIN_SCORE = 0.6;
const STANDOUT_MAX = 3;

const CATEGORY_ORDER = [
  "restaurant",
  "brewery",
  "bar",
  "cafe",
  "bakery",
  "museum",
  "gallery",
  "park",
  "beach",
  "shop",
  "venue",
  "attraction",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurants",
  brewery: "Breweries",
  bar: "Bars",
  cafe: "Cafés",
  bakery: "Bakeries",
  museum: "Museums",
  gallery: "Galleries",
  park: "Parks",
  beach: "Beaches",
  shop: "Shops",
  venue: "Venues",
  attraction: "Attractions",
  other: "Other",
};

interface CategoryGroup {
  key: string;
  label: string;
  places: AppPlace[];
}

function groupByCategory(places: AppPlace[]): CategoryGroup[] {
  const map = new Map<string, AppPlace[]>();
  for (const p of places) {
    const key = p.category || "other";
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }
  return CATEGORY_ORDER
    .filter((key) => map.has(key))
    .map((key) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      places: map.get(key)!,
    }));
}

export function PlacesList() {
  const { filtered, category, setCategory, clearVibes, selectedVibes } = usePlaces();

  const standoutPlaces = useMemo(
    () =>
      filtered
        .filter((p) => typeof p.editorialScore === "number" && p.editorialScore >= STANDOUT_MIN_SCORE)
        .slice(0, STANDOUT_MAX),
    [filtered],
  );

  const standoutIDSet = useMemo(
    () => new Set(standoutPlaces.map((p) => p.id)),
    [standoutPlaces],
  );

  const remaining = useMemo(
    () => filtered.filter((p) => !standoutIDSet.has(p.id)),
    [filtered, standoutIDSet],
  );

  const groups = useMemo(() => groupByCategory(remaining), [remaining]);
  const featured = standoutPlaces[0] ?? filtered[0];
  const showEmpty = filtered.length === 0;
  const showGrouped = category === "all";

  if (showEmpty) {
    return (
      <EmptyState
        title="No places found"
        description="Try a different category, city, or clear your vibe filters."
        actions={
          <div className="flex flex-wrap gap-2">
            {category !== "all" && (
              <Button type="button" variant="secondary" onClick={() => setCategory("all")}>
                All categories
              </Button>
            )}
            {selectedVibes.size > 0 && (
              <Button type="button" variant="ghost" onClick={clearVibes}>
                Clear vibes
              </Button>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div className="min-w-0 space-y-10 scroll-mt-28">
      {featured && (
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-sand-50">
            Standout picks
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
            Top-rated spots curated by our AI.
          </p>
          <div className="mt-4 space-y-4">
            <PlaceCard place={featured} variant="feature" />
            {standoutPlaces.length > 1 && (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                {standoutPlaces.slice(1).map((place) => (
                  <div key={place.id} className="min-w-0">
                    <PlaceCard place={place} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showGrouped ? (
        groups.map((group) => (
          <section className="min-w-0" key={group.key} aria-labelledby={`cat-${group.key}`}>
            <h2
              id={`cat-${group.key}`}
              className="sticky top-14 z-30 -mx-4 bg-sand-50/85 px-4 py-2 font-display text-xl font-semibold text-ink-900 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:text-2xl dark:bg-ink-900/80 dark:text-sand-50"
            >
              {group.label}
              <span className="ml-2 text-sm font-medium text-ink-500 dark:text-ink-300">
                {group.places.length} {group.places.length === 1 ? "place" : "places"}
              </span>
            </h2>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.places.map((place) => (
                <div key={place.id} className="min-w-0">
                  <PlaceCard place={place} />
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        remaining.length > 0 && (
          <section className="min-w-0">
            <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-sand-50">
              All places
            </h2>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {remaining.map((place) => (
                <div key={place.id} className="min-w-0">
                  <PlaceCard place={place} />
                </div>
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}
