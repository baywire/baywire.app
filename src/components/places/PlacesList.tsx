"use client";

import { useMemo } from "react";

import { Button, EmptyState, Heading, StickyDayHeading, Text } from "@/design-system";
import { PlaceCard } from "@/components/PlaceCard";
import { usePlaces } from "@/components/places/PlacesProvider";

import { CATEGORY_LABELS_PLURAL } from "@/lib/places/labels";
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
      label: CATEGORY_LABELS_PLURAL[key] ?? key,
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
          <Heading level="section">
            Standout picks
          </Heading>
          <Text variant="muted" className="mt-1">
            Top-rated spots curated by our AI.
          </Text>
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
            <StickyDayHeading id={`cat-${group.key}`}>
              {group.label}
              <Text variant="muted" as="span" className="ml-2 font-medium">
                {group.places.length} {group.places.length === 1 ? "place" : "places"}
              </Text>
            </StickyDayHeading>
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
            <Heading level="section">
              All places
            </Heading>
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
