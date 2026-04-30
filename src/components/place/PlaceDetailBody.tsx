"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Tag as TagIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AppPlace } from "@/lib/places/types";

import {
  Callout,
  Chip,
  ExternalPillLink,
  Eyebrow,
  Heading,
  MetaRow,
  Tag,
  Text,
  detailSheetClasses,
  navLinkEmphasisClass,
} from "@/design-system";

import { CATEGORY_LABELS, VIBE_LABELS } from "@/lib/places/labels";
import { cityLabel } from "@/lib/cities";
import { cn } from "@/lib/utils";

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
      <Eyebrow as="dt" tone="ink" className="flex items-center gap-2">
        {icon}
        {label}
      </Eyebrow>
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
        imageLayout === "dialog" ? "border-0 shadow-none" : detailSheetClasses(),
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
          <Heading level="section" as="h1" id={titleId} className="leading-tight sm:text-3xl">
            {place.name}
          </Heading>
        )}

        <MetaRow>
          <Chip tone="gulf" icon={<MapPin className="size-3" />}>{city}</Chip>
          <Chip tone="sunset">{categoryLabel}</Chip>
          {place.priceRange && <Chip tone="sand">{place.priceRange}</Chip>}
        </MetaRow>

        {imageLayout === "default" && (
          <Heading level="page" as="h1" className="leading-tight sm:text-4xl">
            {place.name}
          </Heading>
        )}

        {place.whyItsCool && (
          <Callout size="compact">
            <span className="font-semibold text-gulf-700 dark:text-gulf-200">Why this pick:</span>{" "}
            {place.whyItsCool}
          </Callout>
        )}

        {(place.summary ?? place.description) && (
          <Text variant="prose">
            {place.summary ?? place.description}
          </Text>
        )}

        {place.vibes.length > 0 && (
          <Text variant="muted" as="div" className="flex flex-wrap items-center gap-2">
            <TagIcon className="size-4" />
            {place.vibes.map((vibe) => (
              <Tag key={vibe}>
                {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
              </Tag>
            ))}
          </Text>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          {place.address && (
            <DetailRow icon={<MapPin className="size-4" />} label="Address">
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("underline-offset-4 hover:underline", navLinkEmphasisClass)}
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
                className={cn("underline-offset-4 hover:underline", navLinkEmphasisClass)}
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
                className={cn("inline-flex items-center gap-1 underline-offset-4 hover:underline", navLinkEmphasisClass)}
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
