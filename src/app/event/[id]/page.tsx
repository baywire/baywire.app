import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Tag,
  Ticket,
} from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AddToPlanButton } from "@/components/plan/AddToPlanButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import { COOKIE_PLAN } from "@/lib/cookies/constants";
import { parsePlanOrderCookie } from "@/lib/cookies/parse";
import { cityLabel } from "@/lib/cities";
import { getEventById } from "@/lib/db/queries";
import { formatLocal, formatTimeRange } from "@/lib/time/window";
import { formatPrice, safeUrl } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id).catch(() => null);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: event.description ?? `Event in ${cityLabel(event.city)}.`,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: event.imageUrl ? [event.imageUrl] : undefined,
      type: "article",
    },
  };
}

export default async function EventDetailPage({ params }: RouteParams) {
  const { id } = await params;
  const event = await getEventById(id).catch(() => null);
  if (!event) notFound();

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

  const jar = await cookies();
  const initialInPlan = parsePlanOrderCookie(jar.get(COOKIE_PLAN)?.value).includes(id);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50"
          >
            <ArrowLeft className="size-4" />
            Back to events
          </Link>
          <AddToPlanButton eventId={id} initialInPlan={initialInPlan} />
        </div>

        <article className="mt-6 overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900/80">
          {event.imageUrl ? (
            <div className="relative aspect-[16/9] w-full bg-sand-100">
              <Image
                src={event.imageUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 960px, 100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-gulf-100 via-sand-100 to-sunset-100 font-display text-3xl text-ink-500">
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

            <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl dark:text-sand-50">
              {event.title}
            </h1>

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
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-ink-700 dark:bg-sand-50 dark:text-ink-900 dark:hover:bg-sand-200"
                >
                  View on source
                  <ExternalLink className="size-4" />
                </a>
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-ink-400 dark:border-ink-700 dark:text-sand-100 dark:hover:border-ink-500"
                  >
                    Open in Maps
                    <MapPin className="size-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-900 dark:text-sand-50">{children}</dd>
    </div>
  );
}
