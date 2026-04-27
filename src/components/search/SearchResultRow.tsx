"use client";

import { useState } from "react";
import Image from "next/image";
import { Clock, MapPin, Sparkles, Tag } from "lucide-react";

import { EventDialog } from "@/components/event/EventDialog";

import type { AppEvent } from "@/lib/events/types";

import { cityLabel } from "@/lib/cities";
import { formatTimeRange } from "@/lib/time/window";
import { cn, formatPrice } from "@/lib/utils";

interface SearchResultRowProps {
  event: AppEvent;
  reason?: string;
  initialInPlan: boolean;
}

export function SearchResultRow({
  event,
  reason,
  initialInPlan,
}: SearchResultRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const time = formatTimeRange(event.startAt, event.endAt, event.allDay);
  const price = formatPrice(event.priceMin, event.priceMax, event.isFree);
  const city = cityLabel(event.city);

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition",
          "hover:bg-ink-100/50 dark:hover:bg-ink-800/50",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gulf-400 dark:focus-visible:outline-sand-200",
        )}
      >
        {event.imageUrl && (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={event.imageUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900 dark:text-sand-50">
            {event.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500 dark:text-ink-300">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {time}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {event.venueName ?? city}
            </span>
            {price && (
              <span className={event.isFree ? "font-medium text-emerald-600 dark:text-emerald-300" : ""}>
                {price}
              </span>
            )}
          </p>
          {event.categories.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <Tag className="size-2.5 text-ink-400 dark:text-ink-400" />
              {event.categories.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] capitalize text-ink-600 dark:bg-ink-700/60 dark:text-ink-200"
                >
                  {tag}
                </span>
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
      <EventDialog
        event={event}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialInPlan={initialInPlan}
      />
    </>
  );
}
