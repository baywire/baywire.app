"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

import { PlaceCard } from "@/components/PlaceCard";
import type { AppPlace, PlaceCategoryValue } from "@/lib/places/types";
import type { CityKey } from "@/lib/cities";
import { cityLabel } from "@/lib/cities";

interface PlacesClientProps {
  places: AppPlace[];
  initialCity?: string;
  initialCategory?: string;
}

const CATEGORY_OPTIONS: { value: PlaceCategoryValue | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "restaurant", label: "Restaurants" },
  { value: "brewery", label: "Breweries" },
  { value: "bar", label: "Bars" },
  { value: "cafe", label: "Cafés" },
  { value: "bakery", label: "Bakeries" },
  { value: "museum", label: "Museums" },
  { value: "gallery", label: "Galleries" },
  { value: "park", label: "Parks" },
  { value: "beach", label: "Beaches" },
  { value: "shop", label: "Shops" },
  { value: "venue", label: "Venues" },
  { value: "attraction", label: "Attractions" },
];

const CITY_OPTIONS: { value: CityKey | "all"; label: string }[] = [
  { value: "all", label: "All cities" },
  { value: "tampa", label: "Tampa" },
  { value: "st_petersburg", label: "St. Petersburg" },
  { value: "clearwater", label: "Clearwater" },
  { value: "brandon", label: "Brandon" },
  { value: "bradenton", label: "Bradenton" },
  { value: "safety_harbor", label: "Safety Harbor" },
  { value: "dunedin", label: "Dunedin" },
];

const VIBE_OPTIONS = [
  { value: "dog_friendly", label: "Dog Friendly" },
  { value: "outdoor_seating", label: "Outdoor Seating" },
  { value: "kid_friendly", label: "Kid Friendly" },
  { value: "waterfront", label: "Waterfront" },
  { value: "live_music", label: "Live Music" },
  { value: "craft_beer", label: "Craft Beer" },
  { value: "brunch", label: "Brunch" },
  { value: "romantic", label: "Romantic" },
  { value: "hidden_gem", label: "Hidden Gem" },
  { value: "late_night", label: "Late Night" },
  { value: "vegan_friendly", label: "Vegan Friendly" },
  { value: "scenic_views", label: "Scenic Views" },
];

export function PlacesClient({
  places,
  initialCity = "all",
  initialCategory = "all",
}: PlacesClientProps) {
  const [category, setCategory] = useState(initialCategory);
  const [city, setCity] = useState(initialCity);
  const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = places;

    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }
    if (city !== "all") {
      list = list.filter((p) => p.city === city);
    }
    if (selectedVibes.size > 0) {
      list = list.filter((p) => p.vibes.some((v) => selectedVibes.has(v)));
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.dedupedName?.toLowerCase().includes(q) ?? false) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          (p.address?.toLowerCase().includes(q) ?? false),
      );
    }

    return list;
  }, [places, category, city, selectedVibes, search]);

  const toggleVibe = (vibe: string) => {
    setSelectedVibes((prev) => {
      const next = new Set(prev);
      if (next.has(vibe)) next.delete(vibe);
      else next.add(vibe);
      return next;
    });
  };

  const feature = filtered.length > 0 ? filtered[0] : null;
  const rest = filtered.slice(1);

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          placeholder="Search places..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full border border-ink-200 bg-white py-2.5 pl-10 pr-10 text-sm text-ink-900 outline-none transition focus:border-gulf-400 focus:ring-2 focus:ring-gulf-200 dark:border-ink-600 dark:bg-ink-800 dark:text-sand-50 dark:focus:border-gulf-400 dark:focus:ring-gulf-600"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 dark:border-ink-600 dark:bg-ink-800 dark:text-sand-100"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 dark:border-ink-600 dark:bg-ink-800 dark:text-sand-100"
        >
          {CITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Vibe chips */}
      <div className="flex flex-wrap gap-2">
        {VIBE_OPTIONS.map((vibe) => (
          <button
            key={vibe.value}
            type="button"
            onClick={() => toggleVibe(vibe.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedVibes.has(vibe.value)
                ? "border-gulf-400 bg-gulf-50 text-gulf-700 dark:border-gulf-400 dark:bg-gulf-700/30 dark:text-gulf-200"
                : "border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700 dark:border-ink-600 dark:text-ink-300"
            }`}
          >
            {vibe.label}
          </button>
        ))}
        {selectedVibes.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedVibes(new Set())}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300"
          >
            Clear vibes
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-ink-500 dark:text-ink-300">
        {filtered.length === 0
          ? "No places found"
          : `${filtered.length} ${filtered.length === 1 ? "place" : "places"} found`}
        {city !== "all" && ` in ${cityLabel(city as CityKey)}`}
      </p>

      {/* Featured card */}
      {feature && <PlaceCard place={feature} variant="feature" />}

      {/* Grid */}
      {rest.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </div>
  );
}
