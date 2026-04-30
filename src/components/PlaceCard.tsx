"use client";

import Image from "next/image";
import { useState } from "react";
import { Globe, MapPin, Phone, Tag as TagIcon } from "lucide-react";

import {
  Callout,
  CardAffordance,
  CardTitle,
  Chip,
  MetaRow,
  Tag,
  Text,
  cardShellClasses,
} from "@/design-system";
import { PlaceDialog } from "@/components/place/PlaceDialog";

import { CATEGORY_LABELS, VIBE_LABELS } from "@/lib/places/labels";
import type { AppPlace } from "@/lib/places/types";
import { cityLabel } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface PlaceCardProps {
  place: AppPlace;
  variant?: "default" | "feature";
}

export function PlaceCard({ place, variant = "default" }: PlaceCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const city = cityLabel(place.city);
  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";
  const isFeature = variant === "feature";
  const displayName = place.name;

  return (
    <article className={cardShellClasses(cn(isFeature && "lg:min-h-0 lg:flex-row"))}>
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
        <MetaRow>
          <Chip tone="gulf" icon={<MapPin className="size-3" />}>{city}</Chip>
          <Chip tone="sunset">{categoryLabel}</Chip>
          {place.priceRange && <Chip tone="sand">{place.priceRange}</Chip>}
        </MetaRow>

        <CardTitle interactive className={cn(isFeature && "text-2xl lg:text-3xl")}>
          {displayName}
        </CardTitle>

        {(place.summary ?? place.description) && (
          <Text variant="muted" className="line-clamp-3">
            {place.summary ?? place.description}
          </Text>
        )}

        {isFeature && place.whyItsCool && (
          <Callout size="compact">
            <span className="font-semibold text-gulf-700 dark:text-gulf-200">Why this pick:</span>{" "}
            {place.whyItsCool}
          </Callout>
        )}

        <Text variant="muted" as="div" className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
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
        </Text>

        {place.vibes.length > 0 && (
          <Text variant="meta" as="div" className="flex flex-wrap items-center gap-1.5">
            <TagIcon className="size-3" />
            {place.vibes.slice(0, 4).map((vibe) => (
              <Tag key={vibe}>
                {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
              </Tag>
            ))}
          </Text>
        )}

        <CardAffordance />
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
