import { HomeFilterRow, HomeProvider } from "@/components/home/HomeProvider";
import { EventsList } from "@/components/home/EventsList";
import { EmptyState } from "@/components/EmptyState";
import { HeroIntro } from "@/components/HeroIntro";
import { WindowToggle } from "@/components/WindowToggle";
import { HomePlanClient } from "@/components/plan/HomePlanClient";

import { COOKIE_PLAN, COOKIE_SAVED_EVENTS, COOKIE_TOP_TAGS } from "@/lib/cookies/constants";
import { parsePlanOrderCookie, parseSavedEventIdsCookie, parseTopTagsCookie } from "@/lib/cookies/parse";
import { CITY_KEYS, type CityKey } from "@/lib/cities";
import { buildTagOptions } from "@/lib/events/tagOptions";
import { countEventsByCity, listEvents, listUpcomingEventsByIds } from "@/lib/db/queries";
import type { Event } from "@/generated/prisma/client";
import type { WindowKey } from "@/lib/time/window";

import { cookies } from "next/headers";

interface MainColumnProps {
  window: WindowKey;
  city: CityKey | "all";
  freeOnly: boolean;
  defaultOpenFromQuery: boolean;
}

export function SectionSkeleton({ title }: { title: string }) {
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

export async function MainColumn({
  window,
  city,
  freeOnly,
  defaultOpenFromQuery,
}: MainColumnProps) {
  let eventRows: Event[] = [];
  let dbError: string | null = null;
  try {
    eventRows = await listEvents({
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

  const jar = await cookies();
  const initialTop = parseTopTagsCookie(jar.get(COOKIE_TOP_TAGS)?.value);
  const rawSaved = parseSavedEventIdsCookie(jar.get(COOKIE_SAVED_EVENTS)?.value);
  const rawPlan = parsePlanOrderCookie(jar.get(COOKIE_PLAN)?.value);
  const [facets, savedFromServer, planUpcoming] = await Promise.all([
    countEventsByCity(window).catch(() => [] as { city: string; count: number }[]),
    listUpcomingEventsByIds(rawSaved),
    listUpcomingEventsByIds(rawPlan),
  ]);
  const initialSaved = savedFromServer.map((e) => e.id);
  const planIdSet = new Set(planUpcoming.map((e) => e.id));
  const initialPlanOrder = rawPlan.filter((id) => planIdSet.has(id));

  const tagOptions = buildTagOptions(eventRows);
  const facetMap: Record<string, number> = Object.fromEntries(
    facets.map((f) => [f.city, f.count]),
  );
  for (const key of CITY_KEYS) facetMap[key] ??= 0;

  return (
    <HomePlanClient
      orderIds={initialPlanOrder}
      planEvents={planUpcoming}
      defaultOpenFromQuery={defaultOpenFromQuery}
    >
      <HomeProvider
        events={eventRows}
        tagOptions={tagOptions}
        initialTopTags={initialTop}
        initialSavedIds={initialSaved}
        initialPlanOrder={initialPlanOrder}
        savedFromServer={savedFromServer}
        window={window}
      >
        <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-8 pt-10 sm:-mx-6 sm:rounded-b-[2rem] sm:px-8 sm:pb-12 sm:pt-14">
          <HeroIntro />
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4">
            <WindowToggle selected={window} />
            <HomeFilterRow selected={city} facets={facetMap} tagOptions={tagOptions} />
          </div>
        </section>

        <div className="mt-8 min-w-0" id="weekend">
          {eventRows.length === 0 ? (
            <EmptyState
              title="No events found yet"
              description="Try a different time window or city, or wait a few minutes for the next scrape to land."
            />
          ) : (
            <EventsList />
          )}
        </div>
      </HomeProvider>
    </HomePlanClient>
  );
}
