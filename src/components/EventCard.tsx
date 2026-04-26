import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Tag } from "lucide-react";

import type { Event } from "@prisma/client";

import { cityLabel } from "@/lib/cities";
import { formatTimeRange } from "@/lib/time/window";
import { cn, formatPrice } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  variant?: "default" | "feature";
}

export function EventCard({ event, variant = "default" }: EventCardProps) {
  const price = formatPrice(event.priceMin, event.priceMax, event.isFree);
  const time = formatTimeRange(event.startAt, event.endAt, event.allDay);
  const city = cityLabel(event.city);
  const isFeature = variant === "feature";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-ink-700 dark:bg-ink-900/80",
        isFeature && "lg:flex-row",
      )}
    >
      <Link
        href={`/event/${event.id}`}
        className="absolute inset-0 z-10"
        aria-label={event.title}
      />

      {event.imageUrl ? (
        <div
          className={cn(
            "relative aspect-[16/9] w-full overflow-hidden bg-sand-100",
            isFeature && "lg:aspect-auto lg:w-2/5",
          )}
        >
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 480px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized
          />
        </div>
      ) : (
        <div
          className={cn(
            "relative flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500",
            isFeature && "lg:aspect-auto lg:w-2/5",
          )}
        >
          <span className="font-display text-2xl">{city}</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gulf-600 dark:text-gulf-200">
          <span className="inline-flex items-center gap-1 rounded-full bg-gulf-50 px-2 py-0.5 dark:bg-gulf-700/40">
            <MapPin className="size-3" />
            {city}
          </span>
          {price && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5",
                event.isFree
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-200"
                  : "bg-sand-100 text-sand-700 dark:bg-sand-700/30 dark:text-sand-100",
              )}
            >
              {price}
            </span>
          )}
        </div>

        <h3
          className={cn(
            "font-display text-lg font-semibold leading-snug text-ink-900 group-hover:text-gulf-600 dark:text-sand-50 dark:group-hover:text-gulf-200",
            isFeature && "text-2xl lg:text-3xl",
          )}
        >
          {event.title}
        </h3>

        {event.description && (
          <p className="line-clamp-3 text-sm text-ink-500 dark:text-ink-300">
            {event.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500 dark:text-ink-300">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" />
            {time}
          </span>
          {event.venueName && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {event.venueName}
            </span>
          )}
        </div>

        {event.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500 dark:text-ink-300">
            <Tag className="size-3" />
            {event.categories.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-ink-50 px-2 py-0.5 capitalize dark:bg-ink-700/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/85 text-ink-700 opacity-0 shadow transition group-hover:opacity-100 dark:bg-ink-900/80 dark:text-sand-50"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </article>
  );
}
