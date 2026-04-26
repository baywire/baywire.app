"use client";

import Image from "next/image";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Tag,
  Ticket,
} from "lucide-react";
import type { ReactNode } from "react";

import type { Event } from "@/generated/prisma/client";

import { ExternalPillLink } from "@/components/ui";

import { cityLabel } from "@/lib/cities";
import { formatLocal, formatTimeRange } from "@/lib/time/window";
import { cn, formatPrice, safeUrl } from "@/lib/utils";

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

export function EventDetailBody({
  event,
  priorityImage,
  hideTitle = false,
  imageLayout = "default",
}: {
  event: Event;
  /** Next/Image priority (full page or first open). */
  priorityImage?: boolean;
  /** When the title is already shown in a dialog header (or elsewhere). */
  hideTitle?: boolean;
  /** `dialog` caps image height so the modal stays scannable. */
  imageLayout?: "default" | "dialog";
}) {
  const dayLabel = formatLocal(event.startAt, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = formatTimeRange(event.startAt, event.endAt, event.allDay);
  const price = formatPrice(event.priceMin, event.priceMax, event.isFree);
  const sourceUrl = safeUrl(event.eventUrl);
  const mapUrl = event.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
    : null;

  return (
    <article
      className={cn(
        "overflow-hidden bg-white dark:bg-ink-900/80",
        imageLayout === "dialog"
          ? "border-0 shadow-none"
          : "rounded-(--radius-card) border border-ink-100 shadow-sm dark:border-ink-700",
      )}
    >
      {event.imageUrl ? (
        <div
          className={cn(
            "relative w-full overflow-hidden bg-sand-100",
            imageLayout === "dialog"
              ? "h-36 max-h-36 min-h-0 sm:h-40 sm:max-h-40"
              : "aspect-[16/9]",
          )}
        >
          <Image
            src={event.imageUrl}
            alt=""
            fill
            priority={priorityImage}
            sizes={imageLayout === "dialog" ? "560px" : "(min-width: 1024px) 960px, 100vw"}
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center justify-center bg-gradient-to-br from-gulf-100 via-sand-100 to-sunset-100 font-display text-3xl text-ink-500",
            imageLayout === "dialog" ? "h-32 max-h-32 sm:h-36" : "aspect-[16/9]",
          )}
        >
          {cityLabel(event.city)}
        </div>
      )}

      <div className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gulf-600 dark:text-gulf-200">
          <span className="inline-flex items-center gap-1 rounded-full bg-gulf-50 px-2 py-0.5 dark:bg-gulf-700/40">
            <MapPin className="size-3" />
            {cityLabel(event.city)}
          </span>
          {price && (
            <span
              className={
                event.isFree
                  ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-200"
                  : "inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-sand-700 dark:bg-sand-700/30 dark:text-sand-100"
              }
            >
              <Ticket className="size-3" />
              {price}
            </span>
          )}
        </div>

        {!hideTitle && (
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl dark:text-sand-50">
            {event.title}
          </h1>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow icon={<CalendarDays className="size-4" />} label="Date">
            {dayLabel}
          </DetailRow>
          <DetailRow icon={<Clock className="size-4" />} label="Time">
            {time}
          </DetailRow>
          {event.venueName && (
            <DetailRow icon={<MapPin className="size-4" />} label="Venue">
              {event.venueName}
            </DetailRow>
          )}
          {event.address && (
            <DetailRow icon={<MapPin className="size-4" />} label="Address">
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gulf-600 underline-offset-4 hover:underline dark:text-gulf-200"
                >
                  {event.address}
                </a>
              ) : (
                event.address
              )}
            </DetailRow>
          )}
        </dl>

        {event.description && (
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-700 dark:text-sand-100">
            {event.description}
          </p>
        )}

        {event.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500 dark:text-ink-300">
            <Tag className="size-4" />
            {event.categories.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-ink-50 px-2 py-0.5 capitalize dark:bg-ink-700/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {sourceUrl && (
          <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-6 dark:border-ink-700">
            <ExternalPillLink href={sourceUrl} variant="primary">
              View on source
              <ExternalLink className="size-4" />
            </ExternalPillLink>
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
