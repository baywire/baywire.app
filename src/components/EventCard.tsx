"use client";

import Image from "next/image";
import { useState } from "react";
import { Bookmark, Clock, ListOrdered, MapPin, Tag as TagIcon, Ticket } from "lucide-react";

import {
  Callout,
  CardAffordance,
  CardTitle,
  Chip,
  IconButton,
  MetaRow,
  Tag,
  Text,
  cardShellClasses,
} from "@/design-system";
import { EventDialog } from "@/components/event/EventDialog";

import type { AppEvent } from "@/lib/events/types";

import { cityLabel } from "@/lib/cities";
import { formatTimeRange } from "@/lib/time/window";
import { cn, formatPrice } from "@/lib/utils";

interface EventCardProps {
  event: AppEvent;
  variant?: "default" | "feature";
  bookmark?: {
    isSaved: boolean;
    onToggle: (e: React.MouseEvent) => void;
  };
  plan?: {
    inPlan: boolean;
    onToggle: (e: React.MouseEvent) => void;
  };
  initialInPlan?: boolean;
}

export function EventCard({
  event,
  variant = "default",
  bookmark,
  plan,
  initialInPlan = false,
}: EventCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const price = formatPrice(event.priceMin, event.priceMax, event.isFree);
  const time = formatTimeRange(event.startAt, event.endAt, event.allDay);
  const city = cityLabel(event.city);
  const isFeature = variant === "feature";
  const corroboratingSources = event.alsoOnSources ?? [];
  const sourceCount = 1 + corroboratingSources.length;

  return (
    <article className={cardShellClasses(cn(isFeature && "lg:min-h-0 lg:flex-row"))}>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="absolute inset-0 z-10 cursor-pointer rounded-card border-0 bg-transparent p-0 text-left"
        aria-label={`Open details: ${event.title}`}
      />
      <EventDialog
        event={event}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialInPlan={initialInPlan}
      />

      {bookmark && (
        <IconButton
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            bookmark.onToggle(e);
          }}
          className="absolute left-4 top-4"
          aria-pressed={bookmark.isSaved}
          aria-label={bookmark.isSaved ? "Remove from saved" : "Save event"}
        >
          <Bookmark
            className={cn(
              "size-4 text-sand-100",
              bookmark.isSaved && "fill-sunset-400 text-sunset-100",
            )}
            strokeWidth={bookmark.isSaved ? 0 : 2.25}
          />
        </IconButton>
      )}

      {plan && (
        <IconButton
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            plan.onToggle(e);
          }}
          className={cn("absolute", bookmark ? "left-4 top-14" : "left-4 top-4")}
          aria-pressed={plan.inPlan}
          aria-label={plan.inPlan ? "Remove from My plan" : "Add to My plan"}
        >
          <ListOrdered
            className={cn("size-4 text-sand-100", plan.inPlan && "text-gulf-200")}
            strokeWidth={2.25}
          />
        </IconButton>
      )}

      <EventCardImage imageUrl={event.imageUrl} city={city} isFeature={isFeature} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <MetaRow>
          <Chip tone="gulf" icon={<MapPin className="size-3" />}>{city}</Chip>
          {price && (
            <Chip tone={event.isFree ? "emerald" : "sand"}>{price}</Chip>
          )}
          {event.ticketStatus === "sold_out" && (
            <Chip tone="red">Sold out</Chip>
          )}
          {event.ticketUrl && event.ticketStatus !== "sold_out" && !event.isFree && (
            <Chip tone="gulf" icon={<Ticket className="size-3" />}>Tickets</Chip>
          )}
        </MetaRow>

        <CardTitle interactive className={cn(isFeature && "text-2xl lg:text-3xl")}>
          {event.title}
        </CardTitle>

        {event.description && (
          <Text variant="muted" className="line-clamp-3">
            {event.description}
          </Text>
        )}
        {isFeature && event.whyItsCool && (
          <Callout size="compact">
            <span className="font-semibold text-gulf-700 dark:text-gulf-200">Why this pick:</span>{" "}
            {event.whyItsCool}
          </Callout>
        )}
        {sourceCount > 1 && (
          <Text variant="meta">
            Also listed on {sourceCount} sources
            {corroboratingSources.length > 0
              ? ` (${corroboratingSources
                  .slice(0, 2)
                  .map((slug) => slug.replaceAll("_", " "))
                  .join(", ")}${corroboratingSources.length > 2 ? ", ..." : ""})`
              : ""}
          </Text>
        )}

        <Text variant="muted" as="div" className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
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
        </Text>

        {event.categories.length > 0 && (
          <Text variant="meta" as="div" className="flex flex-wrap items-center gap-1.5">
            <TagIcon className="size-3" />
            {event.categories.slice(0, 3).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Text>
        )}

        <CardAffordance />
      </div>
    </article>
  );
}

function EventImagePlaceholder({ city, isFeature }: { city: string; isFeature: boolean }) {
  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500",
        isFeature && "lg:aspect-auto lg:w-2/5",
      )}
    >
      <span className="font-display text-2xl">{city}</span>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[46%] bg-linear-to-b from-black/35 to-transparent"
        aria-hidden
      />
    </div>
  );
}

function EventCardImage({
  imageUrl,
  city,
  isFeature,
}: {
  imageUrl: string | null;
  city: string;
  isFeature: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imageUrl || imgFailed) {
    return <EventImagePlaceholder city={city} isFeature={isFeature} />;
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
