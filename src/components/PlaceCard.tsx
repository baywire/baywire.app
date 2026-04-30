"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, Globe, MapPin, Phone, Tag } from "lucide-react";

import { PlaceDialog } from "@/components/place/PlaceDialog";

import type { AppPlace } from "@/lib/places/types";
import { cityLabel } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface PlaceCardProps {
  place: AppPlace;
  variant?: "default" | "feature";
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  brewery: "Brewery",
  bar: "Bar",
  cafe: "Café",
  bakery: "Bakery",
  museum: "Museum",
  gallery: "Gallery",
  park: "Park",
  beach: "Beach",
  shop: "Shop",
  venue: "Venue",
  attraction: "Attraction",
  other: "Place",
};

const VIBE_LABELS: Record<string, string> = {
  dog_friendly: "Dog Friendly",
  outdoor_seating: "Outdoor Seating",
  kid_friendly: "Kid Friendly",
  family: "Family",
  late_night: "Late Night",
  romantic: "Romantic",
  hidden_gem: "Hidden Gem",
  waterfront: "Waterfront",
  live_music: "Live Music",
  craft_beer: "Craft Beer",
  brunch: "Brunch",
  vegan_friendly: "Vegan Friendly",
  pet_friendly: "Pet Friendly",
  scenic_views: "Scenic Views",
};

export function PlaceCard({ place, variant = "default" }: PlaceCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const city = cityLabel(place.city);
  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";
  const isFeature = variant === "feature";
  const displayName = place.name;

  return (
    <article
      className={cn(
        "group relative flex min-w-0 max-w-full flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-ink-700 dark:bg-ink-900/80",
        isFeature && "lg:min-h-0 lg:flex-row",
      )}
    >
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="absolute inset-0 z-10 cursor-pointer rounded-card border-0 bg-transparent p-0 text-left"
        aria-label={`Open details: ${displayName}`}
      />
      <PlaceDialog
        place={place}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />

      <PlaceCardImage
        imageUrl={place.imageUrl}
        categoryLabel={categoryLabel}
        isFeature={isFeature}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gulf-600 dark:text-gulf-200">
          <span className="inline-flex items-center gap-1 rounded-full bg-gulf-50 px-2 py-0.5 dark:bg-gulf-700/40">
            <MapPin className="size-3" />
            {city}
          </span>
          <span className="inline-flex items-center rounded-full bg-sunset-200 px-2 py-0.5 text-sunset-600 dark:bg-sunset-500/20 dark:text-sunset-300">
            {categoryLabel}
          </span>
          {place.priceRange && (
            <span className="inline-flex items-center rounded-full bg-sand-100 px-2 py-0.5 text-sand-700 dark:bg-sand-700/30 dark:text-sand-100">
              {place.priceRange}
            </span>
          )}
        </div>

        <h3
          className={cn(
            "min-w-0 wrap-break-word font-display text-lg font-semibold leading-snug text-ink-900 group-hover:text-gulf-600 dark:text-sand-50 dark:group-hover:text-gulf-200",
            isFeature && "text-2xl lg:text-3xl",
          )}
        >
          {displayName}
        </h3>

        {(place.summary ?? place.description) && (
          <p className="line-clamp-3 text-sm text-ink-500 dark:text-ink-300">
            {place.summary ?? place.description}
          </p>
        )}

        {isFeature && place.whyItsCool && (
          <p className="rounded-card border border-ink-200 bg-white/80 px-3 py-2 text-sm text-ink-700 dark:border-ink-600 dark:bg-ink-900/70 dark:text-sand-100">
            <span className="font-semibold text-gulf-700 dark:text-gulf-200">Why this pick:</span>{" "}
            {place.whyItsCool}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500 dark:text-ink-300">
          {place.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              <span className="line-clamp-1">{place.address}</span>
            </span>
          )}
          {place.phoneNumber && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4" />
              {place.phoneNumber}
            </span>
          )}
          {place.websiteUrl && (
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-4" />
              Website
            </span>
          )}
        </div>

        {place.vibes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500 dark:text-ink-300">
            <Tag className="size-3" />
            {place.vibes.slice(0, 4).map((vibe) => (
              <span
                key={vibe}
                className="rounded-full bg-ink-50 px-2 py-0.5 dark:bg-ink-700/60"
              >
                {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        )}

        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-ink-900 text-sand-100 opacity-0 shadow-[0_2px_12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] transition group-hover:opacity-100"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </article>
  );
}

function PlaceImagePlaceholder({ categoryLabel, isFeature }: { categoryLabel: string; isFeature: boolean }) {
  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500",
        isFeature && "lg:aspect-auto lg:w-2/5",
      )}
    >
      <span className="font-display text-2xl">{categoryLabel}</span>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[46%] bg-linear-to-b from-black/35 to-transparent"
        aria-hidden
      />
    </div>
  );
}

function PlaceCardImage({
  imageUrl,
  categoryLabel,
  isFeature,
}: {
  imageUrl: string | null;
  categoryLabel: string;
  isFeature: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imageUrl || imgFailed) {
    return <PlaceImagePlaceholder categoryLabel={categoryLabel} isFeature={isFeature} />;
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-sand-100",
        isFeature && "lg:aspect-auto lg:w-2/5",
      )}
    >
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes="(min-width: 1024px) 480px, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        loading={isFeature ? "eager" : "lazy"}
        fetchPriority={isFeature ? "high" : "auto"}
        priority={isFeature}
        unoptimized
        onError={() => setImgFailed(true)}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[42%] bg-linear-to-b from-black/45 to-transparent"
        aria-hidden
      />
    </div>
  );
}
