import type { Metadata } from "next";

import { MainColumnPlaces } from "@/components/places/MainColumnPlaces";

import { isCityKey } from "@/lib/cities";
import { PLACE_CATEGORIES } from "@/lib/extract/schemaPlace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Places — Baywire",
  description: "Discover the best restaurants, breweries, bars, and more across Tampa Bay.",
};

interface SearchParams {
  city?: string;
  category?: string;
  view?: string;
  plan?: string;
  openPlan?: string;
}

export default async function PlacesPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const cityFilter = sp.city && isCityKey(sp.city) ? sp.city : "all";
  const categoryFilter =
    sp.category && (PLACE_CATEGORIES as readonly string[]).includes(sp.category)
      ? (sp.category as typeof PLACE_CATEGORIES[number])
      : "all";
  const defaultOpenFromQuery =
    sp.view === "plan" || sp.plan === "1" || sp.openPlan === "1";

  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col px-0 sm:px-0">
        <MainColumnPlaces
          city={cityFilter}
          category={categoryFilter}
          defaultOpenFromQuery={defaultOpenFromQuery}
        />
      </main>
    </div>
  );
}
