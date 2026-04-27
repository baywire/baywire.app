import { HomeFilterRow, HomeProvider } from "@/components/home/HomeProvider";
import { EventsList } from "@/components/home/EventsList";
import { EmptyState } from "@/components/EmptyState";
import { HeroIntro } from "@/components/HeroIntro";
import { SiteFooter } from "@/components/SiteFooter";
import { HomePlanClient, HomeWithPlanLayout } from "@/components/plan/HomePlanClient";

import { COOKIE_PLAN, COOKIE_SAVED_EVENTS, COOKIE_TOP_TAGS } from "@/lib/cookies/constants";
import { parsePlanOrderCookie, parseSavedEventIdsCookie, parseTopTagsCookie } from "@/lib/cookies/parse";
import { CITY_KEYS, type CityKey } from "@/lib/cities";
import { buildTagOptions } from "@/lib/events/tagOptions";
import { countEventsByCity, listEvents, listUpcomingEventsByIds } from "@/lib/db/queries";
import type { AppEvent } from "@/lib/events/types";
import type { WindowKey } from "@/lib/time/window";

import { cookies } from "next/headers";

interface MainColumnProps {
  window: WindowKey;
  city: CityKey | "all";
  freeOnly: boolean;
  defaultOpenFromQuery: boolean;
}

export async function MainColumn({
  window,
  city,
  freeOnly,
  defaultOpenFromQuery,
}: MainColumnProps) {
  let eventRows: AppEvent[] = [];
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
      <>
        <div className="px-4 pb-12 pt-6 sm:px-5 sm:pb-16">
          <EmptyState
            title="Couldn't reach the event database"
            description={`Make sure DATABASE_URL is set and migrations have run. (${dbError})`}
          />
        </div>
        <div className="-mx-4 sm:-mx-5">
          <SiteFooter />
        </div>
      </>
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
        initialTopTags={initialTop}
        initialSavedIds={initialSaved}
        savedFromServer={savedFromServer}
        window={window}
      >
        <HomeWithPlanLayout>
          <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-6 pt-8 sm:-mx-5 sm:rounded-b-[2rem] sm:px-8 sm:pb-10 sm:pt-10">
            <HeroIntro />
            <div className="mx-auto mt-6 w-full max-w-5xl px-1 sm:px-0">
              <HomeFilterRow
                window={window}
                selected={city}
                facets={facetMap}
                tagOptions={tagOptions}
              />
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

          <div className="-mx-4 sm:-mx-5">
            <SiteFooter />
          </div>
        </HomeWithPlanLayout>
      </HomeProvider>
    </HomePlanClient>
  );
}
