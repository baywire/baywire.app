"use client";

import { Button, FilterChip } from "@/design-system";
import { usePlaces } from "@/components/places/PlacesProvider";
import { VIBE_LABELS } from "@/lib/places/labels";

const VIBE_OPTIONS = Object.entries(VIBE_LABELS).map(([value, label]) => ({ value, label }));

export function PlacesVibeFilter() {
  const { selectedVibes, toggleVibe, clearVibes } = usePlaces();

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {VIBE_OPTIONS.map((vibe) => (
          <FilterChip
            key={vibe.value}
            tone="gulf"
            selected={selectedVibes.has(vibe.value)}
            onClick={() => toggleVibe(vibe.value)}
          >
            {vibe.label}
          </FilterChip>
        ))}
        {selectedVibes.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearVibes}
            className="ml-2 text-red-600 underline-offset-2 hover:underline dark:text-red-300"
          >
            Clear vibes
          </Button>
        )}
      </div>
    </div>
  );
}
