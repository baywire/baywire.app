"use client";

import { usePlaces } from "@/components/places/PlacesProvider";
import { cn } from "@/lib/utils";

const VIBE_OPTIONS = [
  { value: "dog_friendly", label: "Dog Friendly" },
  { value: "outdoor_seating", label: "Outdoor Seating" },
  { value: "kid_friendly", label: "Kid Friendly" },
  { value: "family", label: "Family" },
  { value: "waterfront", label: "Waterfront" },
  { value: "live_music", label: "Live Music" },
  { value: "craft_beer", label: "Craft Beer" },
  { value: "brunch", label: "Brunch" },
  { value: "romantic", label: "Romantic" },
  { value: "hidden_gem", label: "Hidden Gem" },
  { value: "late_night", label: "Late Night" },
  { value: "vegan_friendly", label: "Vegan Friendly" },
  { value: "pet_friendly", label: "Pet Friendly" },
  { value: "scenic_views", label: "Scenic Views" },
];

export function PlacesVibeFilter() {
  const { selectedVibes, toggleVibe, clearVibes } = usePlaces();

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {VIBE_OPTIONS.map((vibe) => (
          <button
            key={vibe.value}
            type="button"
            onClick={() => toggleVibe(vibe.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              selectedVibes.has(vibe.value)
                ? "border-gulf-400 bg-gulf-50 text-gulf-700 dark:border-gulf-400 dark:bg-gulf-700/30 dark:text-gulf-200"
                : "border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700 dark:border-ink-600 dark:text-ink-300",
            )}
          >
            {vibe.label}
          </button>
        ))}
        {selectedVibes.size > 0 && (
          <button
            type="button"
            onClick={clearVibes}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300"
          >
            Clear vibes
          </button>
        )}
      </div>
    </div>
  );
}
