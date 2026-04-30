import { PlacesFilterRow } from "@/components/places/PlacesFilterRow";
import { PlacesHeroIntro } from "@/components/places/PlacesHeroIntro";
import { PlacesList } from "@/components/places/PlacesList";
import { PlacesProvider } from "@/components/places/PlacesProvider";
import { PlacesVibeFilter } from "@/components/places/PlacesVibeFilter";
import { HomePlanClient, HomeWithPlanLayout } from "@/components/plan/HomePlanClient";
import { SiteFooter } from "@/components/SiteFooter";

import { COOKIE_PLAN } from "@/lib/cookies/constants";
import { parsePlanOrderCookie } from "@/lib/cookies/parse";
import { CITY_KEYS, type CityKey } from "@/lib/cities";
import { listUpcomingEventsByIds } from "@/lib/db/queries";
import { countPlacesByCity, listPlaces } from "@/lib/db/queriesPlaces";
import type { PlaceCategoryValue } from "@/lib/places/types";

import { cookies } from "next/headers";

interface MainColumnPlacesProps {
  city: CityKey | "all";
  category: PlaceCategoryValue | "all";
  defaultOpenFromQuery: boolean;
}

export async function MainColumnPlaces({
  city,
  category,
  defaultOpenFromQuery,
}: MainColumnPlacesProps) {
  const places = await listPlaces({
    cities: city === "all" ? undefined : [city],
    categories: category === "all" ? undefined : [category],
    limit: 200,
  });

  const jar = await cookies();
  const rawPlan = parsePlanOrderCookie(jar.get(COOKIE_PLAN)?.value);
  const [facets, planUpcoming] = await Promise.all([
    countPlacesByCity().catch(() => [] as { city: string; count: number }[]),
    listUpcomingEventsByIds(rawPlan),
  ]);

  const planIdSet = new Set(planUpcoming.map((e) => e.id));
  const initialPlanOrder = rawPlan.filter((id) => planIdSet.has(id));

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
      <PlacesProvider
        places={places}
        initialCity={city}
        initialCategory={category}
      >
        <HomeWithPlanLayout>
          <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-6 pt-8 sm:-mx-5 sm:rounded-b-4xl sm:px-8 sm:pb-10 sm:pt-10">
            <PlacesHeroIntro totalCount={places.length} />
            <div className="mx-auto mt-6 w-full max-w-5xl px-1 sm:px-0">
              <PlacesFilterRow selected={city} facets={facetMap} />
            </div>
          </section>

          <div className="mx-auto mt-6 w-full">
            <PlacesVibeFilter />
          </div>

          <div className="mt-8 min-w-0">
            <PlacesList />
          </div>

          <div className="-mx-4 sm:-mx-5">
            <SiteFooter />
          </div>
        </HomeWithPlanLayout>
      </PlacesProvider>
    </HomePlanClient>
  );
}
