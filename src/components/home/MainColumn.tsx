import { HomeFilterRow, HomeProvider, HomeTagFilterRow } from "@/components/home/HomeProvider";
import { EventsList } from "@/components/home/EventsList";
import { EmptyState } from "@/design-system/composites";
import { HeroIntro } from "@/components/HeroIntro";
import { SiteFooter } from "@/components/SiteFooter";
import { HomePlanClient, HomeWithPlanLayout } from "@/components/plan/HomePlanClient";

import { COOKIE_PLAN, COOKIE_SAVED_EVENTS, COOKIE_TOP_TAGS } from "@/lib/cookies/constants";
import { parsePlanOrderCookie, parseSavedEventIdsCookie, parseTopTagsCookie } from "@/lib/cookies/parse";
import { CITY_KEYS, type CityKey } from "@/lib/cities";
import { buildTagOptions } from "@/lib/events/tagOptions";
import {
  countEventsByCity,
  getCurationCoverage,
  listEvents,
  listUpcomingEventsByIds,
} from "@/lib/db/queries";
import { listPlacesByIds } from "@/lib/db/queriesPlaces";
import type { AppEvent } from "@/lib/events/types";
import type { WindowKey } from "@/lib/time/window";

import { cookies } from "next/headers";
import Link from "next/link";

import { buttonClasses } from "@/design-system";

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
  function buildHomeHref(next: {
    window?: WindowKey;
    city?: CityKey | "all";
    freeOnly?: boolean;
  }): { pathname: "/"; query?: Record<string, string> } {
    const query: Record<string, string> = {};
    query.window = next.window ?? window;
    const nextCity = next.city ?? city;
    if (nextCity !== "all") query.city = nextCity;
    if (next.freeOnly ?? freeOnly) query.free = "true";
    return Object.keys(query).length > 0 ? { pathname: "/", query } : { pathname: "/" };
  }

  let eventRows: AppEvent[] = [];
  let curation = {
    visibleCount: 0,
    curatedCount: 0,
    coveragePct: 0,
    refreshedAt: null as Date | null,
  };
  let dbError = false;
  try {
    const filters = {
      window,
      cities: city === "all" ? undefined : [city],
      freeOnly,
    };
    const [rows, coverage] = await Promise.all([listEvents(filters), getCurationCoverage(filters)]);
    eventRows = rows;
    curation = coverage;
  } catch (err) {
    dbError = true;
    console.error("listEvents failed", { window, city, freeOnly, err });
  }

  if (dbError) {
    return (
      <>
        <div className="px-4 pb-12 pt-6 sm:px-5 sm:pb-16">
          <EmptyState
            title="Couldn't reach the event database"
            description="We're having trouble loading events right now. Please try again in a moment."
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
  const [facets, savedFromServer, planUpcoming, planPlaces] = await Promise.all([
    countEventsByCity({ window, freeOnly }).catch(() => [] as { city: string; count: number }[]),
    listUpcomingEventsByIds(rawSaved),
    listUpcomingEventsByIds(rawPlan),
    listPlacesByIds(rawPlan),
  ]);
  const initialSaved = savedFromServer.map((e) => e.id);
  const validPlanIds = new Set([
    ...planUpcoming.map((e) => e.id),
    ...planPlaces.map((p) => p.id),
  ]);
  const initialPlanOrder = rawPlan.filter((id) => validPlanIds.has(id));

  const tagOptions = buildTagOptions(eventRows);
  const facetMap: Record<string, number> = Object.fromEntries(
    facets.map((f) => [f.city, f.count]),
  );
  for (const key of CITY_KEYS) facetMap[key] ??= 0;

  return (
    <HomePlanClient
      orderIds={initialPlanOrder}
      planEvents={planUpcoming}
      planPlaces={planPlaces}
      defaultOpenFromQuery={defaultOpenFromQuery}
    >
      <HomeProvider
        events={eventRows}
        initialTopTags={initialTop}
        initialSavedIds={initialSaved}
        savedFromServer={savedFromServer}
        window={window}
        selectedCity={city}
        freeOnly={freeOnly}
      >
        <HomeWithPlanLayout>
          <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-6 pt-8 sm:-mx-5 sm:rounded-b-4xl sm:px-8 sm:pb-10 sm:pt-10">
            <HeroIntro curation={curation} />
            <div className="mx-auto mt-6 w-full max-w-5xl px-1 sm:px-0">
              <HomeFilterRow
                window={window}
                selected={city}
                facets={facetMap}
                tagOptions={tagOptions}
                showTags={false}
              />
            </div>
          </section>

          <div className="mx-auto mt-6 w-full ">
            <HomeTagFilterRow tagOptions={tagOptions} />
          </div>

          <div className="mt-8 min-w-0" id="weekend">
            {eventRows.length === 0 ? (
              <EmptyState
                title="No events found yet"
                description="Try a different time window or city, or wait a few minutes for the next scrape to land."
                actions={
                  <>
                    <Link
                      href={buildHomeHref({ city: "all", freeOnly: false })}
                      className={buttonClasses({ variant: "secondary", size: "md" })}
                    >
                      Broaden filters
                    </Link>
                    <Link
                      href={buildHomeHref({ window: "week", city: "all" })}
                      className={buttonClasses({ variant: "ghost", size: "md" })}
                    >
                      Expand to this week
                    </Link>
                  </>
                }
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
