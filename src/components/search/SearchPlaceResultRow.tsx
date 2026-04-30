"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MapPin, Sparkles, Tag as TagIcon } from "lucide-react";

import { FallbackImage } from "@/components/FallbackImage";

import { Chip, Tag, Text } from "@/design-system";

import { CATEGORY_LABELS, VIBE_LABELS } from "@/lib/places/labels";
import type { AppPlace } from "@/lib/places/types";
import { cityLabel } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface SearchPlaceResultRowProps {
  place: AppPlace;
  onClose: () => void;
  reason?: string;
}

export function SearchPlaceResultRow({ place, onClose, reason }: SearchPlaceResultRowProps) {
  const router = useRouter();
  const city = cityLabel(place.city);
  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";

  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        router.push(`/place/${place.slug}` as Route);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition",
        "hover:bg-ink-100/50 dark:hover:bg-ink-800/50",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gulf-400 dark:focus-visible:outline-sand-200",
      )}
    >
      <SearchPlaceThumb imageUrl={place.imageUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900 dark:text-sand-50">
          {place.name}
        </p>
        <Text variant="meta" as="p" className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {city}
          </span>
          <Chip tone="sunset">{categoryLabel}</Chip>
          {place.priceRange && (
            <span className="text-ink-400">{place.priceRange}</span>
          )}
        </Text>
        {(place.summary ?? place.description) && (
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-400 dark:text-ink-400">
            {place.summary ?? place.description}
          </p>
        )}
        {place.vibes.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <TagIcon className="size-2.5 text-ink-400 dark:text-ink-400" />
            {place.vibes.slice(0, 3).map((vibe) => (
              <Tag key={vibe} size="xs">
                {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
              </Tag>
            ))}
          </div>
        )}
        {reason && (
          <p className="mt-1 flex items-start gap-1 text-xs text-gulf-600 dark:text-gulf-300">
            <Sparkles className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{reason}</span>
          </p>
        )}
      </div>
    </button>
  );
}

function SearchPlaceThumbPlaceholder() {
  return (
    <div
      aria-hidden
      className="flex size-full items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500"
    >
      <MapPin className="size-4" />
    </div>
  );
}

function SearchPlaceThumb({ imageUrl }: { imageUrl: string | null }) {
  const placeholder = <SearchPlaceThumbPlaceholder />;
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
      {imageUrl ? (
        <FallbackImage
          src={imageUrl}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
          fallback={placeholder}
        />
      ) : (
        placeholder
      )}
    </div>
  );
}
