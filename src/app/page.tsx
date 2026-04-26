import { Suspense } from "react";

import { CityFilter } from "@/components/CityFilter";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WindowToggle } from "@/components/WindowToggle";

import type { Event } from "@/generated/prisma/client";

import { CITY_KEYS, isCityKey, type CityKey } from "@/lib/cities";
import { countEventsByCity, listEvents } from "@/lib/db/queries";
import { TZ, formatDayHeader, getWindow, type WindowKey } from "@/lib/time/window";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SearchParams {
  window?: string;
  city?: string;
  free?: string;
}

export default async function HomePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const window: WindowKey =
    sp.window === "tonight" || sp.window === "week" ? sp.window : "weekend";
  const cityParam = sp.city && isCityKey(sp.city) ? sp.city : "all";
  const freeOnly = sp.free === "true";

  const windowMeta = getWindow(window);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:px-6">
        <Hero window={window} city={cityParam} />

        <div className="mt-8" id="weekend">
          <Suspense fallback={<SectionSkeleton title={windowMeta.label} />}>
            <EventsSection
              window={window}
              city={cityParam}
              freeOnly={freeOnly}
            />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Hero({ window, city }: { window: WindowKey; city: CityKey | "all" }) {
  return (
    <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-8 pt-10 sm:-mx-6 sm:rounded-b-[2rem] sm:px-8 sm:pb-12 sm:pt-14">
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gulf-600 dark:text-gulf-200">
          AI-curated · Updated every few hours
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl md:text-6xl dark:text-sand-50">
          Find your next favorite night out in{" "}
          <span className="bg-gradient-to-r from-sunset-500 to-gulf-500 bg-clip-text text-transparent">
            Tampa Bay
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-ink-500 sm:text-lg dark:text-ink-300">
          A live feed of music, food, art, family fun, and free things to do —
          gathered from across Tampa, St. Pete, Clearwater, Brandon, and
          Bradenton.
        </p>
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4">
        <WindowToggle selected={window} />
        <Suspense fallback={null}>
          <CityFilterAsync window={window} selected={city} />
        </Suspense>
      </div>
    </section>
  );
}

async function CityFilterAsync({
  window,
  selected,
}: {
  window: WindowKey;
  selected: CityKey | "all";
}) {
  const facets = await countEventsByCity(window).catch(() => []);
  const facetMap = Object.fromEntries(facets.map((f) => [f.city, f.count]));
  // Ensure every key has a numeric placeholder so the UI is stable.
  for (const key of CITY_KEYS) facetMap[key] ??= 0;
  return <CityFilter selected={selected} facets={facetMap} />;
}

async function EventsSection({
  window,
  city,
  freeOnly,
}: {
  window: WindowKey;
  city: CityKey | "all";
  freeOnly: boolean;
}) {
  let rows: Event[] = [];
  let dbError: string | null = null;
  try {
    rows = await listEvents({
      window,
      cities: city === "all" ? undefined : [city],
      freeOnly,
      limit: 200,
    });
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unknown database error";
  }

  if (dbError) {
    return (
      <EmptyState
        title="Couldn't reach the event database"
        description={`Make sure DATABASE_URL is set and migrations have run. (${dbError})`}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No events found yet"
        description="Try a different time window or city, or wait a few minutes for the next scrape to land."
      />
    );
  }

  const groups = groupByDay(rows);
  const featured = rows[0];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-sand-50">
          Featured pick
        </h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
          Our top hit for {getWindow(window).label.toLowerCase()}.
        </p>
        <div className="mt-4">
          <EventCard event={featured} variant="feature" />
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`day-${group.key}`}>
          <h2
            id={`day-${group.key}`}
            className="sticky top-[57px] z-20 -mx-4 bg-sand-50/85 px-4 py-2 font-display text-xl font-semibold text-ink-900 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:text-2xl dark:bg-ink-900/80 dark:text-sand-50"
          >
            {group.label}
            <span className="ml-2 text-sm font-medium text-ink-500 dark:text-ink-300">
              {group.events.length} event{group.events.length === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface DayGroup {
  key: string;
  label: string;
  events: Event[];
}

function groupByDay(rows: Event[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const row of rows) {
    const key = fmt.format(row.startAt);
    let group = map.get(key);
    if (!group) {
      group = { key, label: formatDayHeader(row.startAt), events: [] };
      map.set(key, group);
    }
    group.events.push(row);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-sand-50">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-(--radius-card) border border-ink-100 bg-white/70 dark:border-ink-700 dark:bg-ink-900/60"
          />
        ))}
      </div>
    </div>
  );
}
