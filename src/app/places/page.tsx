import type { Metadata } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { listPlaces } from "@/lib/db/queriesPlaces";
import { isCityKey } from "@/lib/cities";
import { PLACE_CATEGORIES } from "@/lib/extract/schemaPlace";

import { PlacesClient } from "./PlacesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Places — Baywire",
  description: "Discover the best restaurants, breweries, bars, and more across Tampa Bay.",
};

interface SearchParams {
  city?: string;
  category?: string;
}

export default async function PlacesPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const cityFilter = sp.city && isCityKey(sp.city) ? sp.city : undefined;
  const categoryFilter =
    sp.category && (PLACE_CATEGORIES as readonly string[]).includes(sp.category)
      ? sp.category
      : undefined;

  const places = await listPlaces({
    cities: cityFilter ? [cityFilter] : undefined,
    categories: categoryFilter ? [categoryFilter as typeof PLACE_CATEGORIES[number]] : undefined,
    limit: 200,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-ink-900 dark:text-sand-50 sm:text-4xl">
            Discover Places
          </h1>
          <p className="mt-2 text-ink-500 dark:text-ink-300">
            The best restaurants, breweries, bars, and local gems across Tampa Bay.
          </p>
        </div>

        <PlacesClient
          places={places}
          initialCity={cityFilter ?? "all"}
          initialCategory={categoryFilter ?? "all"}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
