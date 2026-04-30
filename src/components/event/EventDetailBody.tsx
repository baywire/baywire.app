"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Tag as TagIcon,
  Ticket,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AppEvent } from "@/lib/events/types";

import {
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

import { cityLabel } from "@/lib/cities";
import { formatLocal, formatTimeRange } from "@/lib/time/window";
import { cn, formatPrice, safeUrl } from "@/lib/utils";

function ticketCtaLabel(status: string | null | undefined): string {
  switch (status) {
    case "rsvp": return "RSVP";
    case "free": return "Get free tickets";
    case "not_yet": return "Notify me";
    default: return "Buy tickets";
  }
}

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

export function EventDetailBody({
  event,
  priorityImage,
  hideTitle = false,
  imageLayout = "default",
  titleId,
}: {
  event: AppEvent;
  priorityImage?: boolean;
  hideTitle?: boolean;
  imageLayout?: "default" | "dialog";
  titleId?: string;
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
  const ticketUrl = safeUrl(event.ticketUrl);
  const ticketStatus = event.ticketStatus;
  const mapUrl = event.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
    : null;

  return (
    <article
      className={cn(
        "overflow-hidden bg-white dark:bg-ink-900/80",
        imageLayout === "dialog" ? "border-0 shadow-none" : detailSheetClasses(),
      )}
    >
      <EventDetailImage
        imageUrl={event.imageUrl}
        city={cityLabel(event.city)}
        imageLayout={imageLayout}
        priorityImage={priorityImage}
      />

      <div className="space-y-6 p-6 sm:p-8">
        {!hideTitle && imageLayout === "dialog" && (
          <Heading level="section" as="h1" id={titleId} className="leading-tight sm:text-3xl">
            {event.title}
          </Heading>
        )}

        <MetaRow>
          <Chip tone="gulf" icon={<MapPin className="size-3" />}>{cityLabel(event.city)}</Chip>
          {price && (
            <Chip tone={event.isFree ? "emerald" : "sand"} icon={<Ticket className="size-3" />}>
              {price}
            </Chip>
          )}
          {ticketStatus === "sold_out" && <Chip tone="red">Sold out</Chip>}
        </MetaRow>

        {!hideTitle && imageLayout === "default" && (
          <Heading level="page" as="h1" className="leading-tight sm:text-4xl">
            {event.title}
          </Heading>
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
                  className={cn("underline-offset-4 hover:underline", navLinkEmphasisClass)}
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
          <Text variant="prose">{event.description}</Text>
        )}

        {event.categories.length > 0 && (
          <Text variant="muted" as="div" className="flex flex-wrap items-center gap-2">
            <TagIcon className="size-4" />
            {event.categories.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Text>
        )}

        {(ticketUrl || sourceUrl) && (
          <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-6 dark:border-ink-700">
            {ticketUrl && ticketStatus !== "sold_out" ? (
              <ExternalPillLink href={ticketUrl} variant="primary">
                <Ticket className="size-4" />
                {ticketCtaLabel(ticketStatus)}
              </ExternalPillLink>
            ) : null}
            {sourceUrl && (
              <ExternalPillLink
                href={sourceUrl}
                variant={ticketUrl && ticketStatus !== "sold_out" ? "outline" : "primary"}
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

        {event.onSaleAt && new Date(event.onSaleAt) > new Date() && (
          <Text variant="muted">
            Tickets on sale {formatLocal(event.onSaleAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </Text>
        )}
      </div>
    </article>
  );
}

function EventDetailImagePlaceholder({
  city,
  imageLayout,
}: {
  city: string;
  imageLayout: "default" | "dialog";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 font-display text-3xl text-ink-500",
        imageLayout === "dialog" ? "h-32 max-h-32 sm:h-36" : "aspect-video",
      )}
    >
      {city}
    </div>
  );
}

function EventDetailImage({
  imageUrl,
  city,
  imageLayout,
  priorityImage,
}: {
  imageUrl: string | null;
  city: string;
  imageLayout: "default" | "dialog";
  priorityImage?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imageUrl || imgFailed) {
    return <EventDetailImagePlaceholder city={city} imageLayout={imageLayout} />;
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
