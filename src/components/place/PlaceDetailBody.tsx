"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AppPlace } from "@/lib/places/types";

import { ExternalPillLink } from "@/components/ui";

import { cityLabel } from "@/lib/cities";
import { cn } from "@/lib/utils";

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

function DetailRow({
  icon,
  label,
  children: dd,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-900 dark:text-sand-50">{dd}</dd>
    </div>
  );
}

export function PlaceDetailBody({
  place,
  priorityImage,
  imageLayout = "default",
  titleId,
}: {
  place: AppPlace;
  priorityImage?: boolean;
  imageLayout?: "default" | "dialog";
  titleId?: string;
}) {
  const city = cityLabel(place.city);
  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";
  const hours = parseHoursJson(place.hoursJson);
  const mapUrl = place.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`
    : null;

  return (
    <article
      className={cn(
        "overflow-hidden bg-white dark:bg-ink-900/80",
        imageLayout === "dialog"
          ? "border-0 shadow-none"
          : "rounded-card border border-ink-100 shadow-sm dark:border-ink-700",
      )}
    >
      <PlaceDetailImage
        imageUrl={place.imageUrl}
        categoryLabel={categoryLabel}
        imageLayout={imageLayout}
        priorityImage={priorityImage}
      />

      <div className="space-y-6 p-6 sm:p-8">
        {imageLayout === "dialog" && (
          <h1
            id={titleId}
            className="font-display text-2xl font-semibold leading-tight text-ink-900 sm:text-3xl dark:text-sand-50"
          >
            {place.name}
          </h1>
        )}

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

        {imageLayout === "default" && (
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl dark:text-sand-50">
            {place.name}
          </h1>
        )}

        {place.whyItsCool && (
          <p className="rounded-card border border-ink-200 bg-white/80 px-3 py-2 text-sm text-ink-700 dark:border-ink-600 dark:bg-ink-900/70 dark:text-sand-100">
            <span className="font-semibold text-gulf-700 dark:text-gulf-200">Why this pick:</span>{" "}
            {place.whyItsCool}
          </p>
        )}

        {(place.summary ?? place.description) && (
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-700 dark:text-sand-100">
            {place.summary ?? place.description}
          </p>
        )}

        {place.vibes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500 dark:text-ink-300">
            <Tag className="size-4" />
            {place.vibes.map((vibe) => (
              <span
                key={vibe}
                className="rounded-full bg-gulf-50 px-2 py-0.5 text-xs font-medium text-gulf-700 dark:bg-gulf-700/30 dark:text-gulf-200"
              >
                {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          {place.address && (
            <DetailRow icon={<MapPin className="size-4" />} label="Address">
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gulf-600 underline-offset-4 hover:underline dark:text-gulf-200"
                >
                  {place.address}
                </a>
              ) : (
                place.address
              )}
            </DetailRow>
          )}
          {place.phoneNumber && (
            <DetailRow icon={<Phone className="size-4" />} label="Phone">
              <a
                href={`tel:${place.phoneNumber}`}
                className="text-gulf-600 underline-offset-4 hover:underline dark:text-gulf-200"
              >
                {place.phoneNumber}
              </a>
            </DetailRow>
          )}
          {place.websiteUrl && (
            <DetailRow icon={<Globe className="size-4" />} label="Website">
              <a
                href={place.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gulf-600 underline-offset-4 hover:underline dark:text-gulf-200"
              >
                Visit website
                <ExternalLink className="size-3" />
              </a>
            </DetailRow>
          )}
          {hours.length > 0 && (
            <DetailRow icon={<Clock className="size-4" />} label="Hours">
              <div className="flex flex-col gap-0.5">
                {hours.map((h, i) => (
                  <span key={i}>{h}</span>
                ))}
              </div>
            </DetailRow>
          )}
        </dl>

        {(place.websiteUrl || place.sourceUrl || mapUrl) && (
          <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-6 dark:border-ink-700">
            {place.websiteUrl && (
              <ExternalPillLink href={place.websiteUrl} variant="primary">
                <Globe className="size-4" />
                Visit website
              </ExternalPillLink>
            )}
            {place.sourceUrl && (
              <ExternalPillLink
                href={place.sourceUrl}
                variant={place.websiteUrl ? "outline" : "primary"}
              >
                View on source
                <ExternalLink className="size-4" />
              </ExternalPillLink>
            )}
            {mapUrl && (
              <ExternalPillLink href={mapUrl} variant="outline">
                Open in Maps
                <MapPin className="size-4" />
              </ExternalPillLink>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function PlaceDetailImagePlaceholder({
  categoryLabel,
  imageLayout,
}: {
  categoryLabel: string;
  imageLayout: "default" | "dialog";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 font-display text-3xl text-ink-500",
        imageLayout === "dialog" ? "h-32 max-h-32 sm:h-36" : "aspect-video",
      )}
    >
      {categoryLabel}
    </div>
  );
}

function PlaceDetailImage({
  imageUrl,
  categoryLabel,
  imageLayout,
  priorityImage,
}: {
  imageUrl: string | null;
  categoryLabel: string;
  imageLayout: "default" | "dialog";
  priorityImage?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imageUrl || imgFailed) {
    return <PlaceDetailImagePlaceholder categoryLabel={categoryLabel} imageLayout={imageLayout} />;
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-sand-100",
        imageLayout === "dialog"
          ? "h-36 max-h-36 min-h-0 sm:h-40 sm:max-h-40"
          : "aspect-video",
      )}
    >
      <Image
        src={imageUrl}
        alt=""
        fill
        priority={priorityImage}
        sizes={imageLayout === "dialog" ? "560px" : "(min-width: 1024px) 960px, 100vw"}
        className="object-cover"
        unoptimized
        onError={() => setImgFailed(true)}
      />
    </div>
  );
}

function parseHoursJson(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((h): h is string => typeof h === "string");
  return [];
}
