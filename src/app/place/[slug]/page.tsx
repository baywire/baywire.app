import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, Globe, MapPin, Phone, Tag } from "lucide-react";
import type { Metadata } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { cityLabel } from "@/lib/cities";
import { getPlaceBySlug } from "@/lib/db/queriesPlaces";

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  brewery: "Brewery",
  bar: "Bar",
  cafe: "Café",
  bakery: "Bakery",
  museum: "Museum",
  gallery: "Gallery",
  park: "Park",
  beach: "Beach",
  shop: "Shop",
  venue: "Venue",
  attraction: "Attraction",
  other: "Place",
};

const VIBE_LABELS: Record<string, string> = {
  dog_friendly: "Dog Friendly",
  outdoor_seating: "Outdoor Seating",
  kid_friendly: "Kid Friendly",
  family: "Family",
  late_night: "Late Night",
  romantic: "Romantic",
  hidden_gem: "Hidden Gem",
  waterfront: "Waterfront",
  live_music: "Live Music",
  craft_beer: "Craft Beer",
  brunch: "Brunch",
  vegan_friendly: "Vegan Friendly",
  pet_friendly: "Pet Friendly",
  scenic_views: "Scenic Views",
};

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(() => null);
  if (!place) return { title: "Place not found" };
  const displayName = place.dedupedName ?? place.name;
  return {
    title: `${displayName} — Baywire`,
    description:
      place.summary ?? place.description ?? `${displayName} in ${cityLabel(place.city)}.`,
    openGraph: {
      title: displayName,
      description: place.summary ?? place.description ?? undefined,
      images: place.imageUrl ? [place.imageUrl] : undefined,
      type: "article",
    },
  };
}

export default async function PlaceDetailPage({ params }: RouteParams) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(() => null);
  if (!place) notFound();

  const displayName = place.dedupedName ?? place.name;
  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";
  const city = cityLabel(place.city);
  const hours = parseHoursJson(place.hoursJson);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <Link
          href={"/places" as Route}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50"
        >
          <ArrowLeft className="size-4" />
          Back to places
        </Link>

        <div className="mt-6 flex flex-col gap-6">
          {place.imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-card bg-sand-100">
              <Image
                src={place.imageUrl}
                alt={displayName}
                fill
                sizes="(min-width: 896px) 896px, 100vw"
                className="object-cover"
                priority
                unoptimized
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gulf-600 dark:text-gulf-200">
            <span className="inline-flex items-center gap-1 rounded-full bg-gulf-50 px-2.5 py-1 dark:bg-gulf-700/40">
              <MapPin className="size-3" />
              {city}
            </span>
            <span className="inline-flex items-center rounded-full bg-sunset-50 px-2.5 py-1 text-sunset-700 dark:bg-sunset-700/30 dark:text-sunset-200">
              {categoryLabel}
            </span>
            {place.priceRange && (
              <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-1 text-sand-700 dark:bg-sand-700/30 dark:text-sand-100">
                {place.priceRange}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl font-bold text-ink-900 dark:text-sand-50 sm:text-4xl">
            {displayName}
          </h1>

          {place.whyItsCool && (
            <p className="rounded-card border border-ink-200 bg-white/80 px-4 py-3 text-sm text-ink-700 dark:border-ink-600 dark:bg-ink-900/70 dark:text-sand-100">
              <span className="font-semibold text-gulf-700 dark:text-gulf-200">
                Why this pick:
              </span>{" "}
              {place.whyItsCool}
            </p>
          )}

          {(place.summary ?? place.description) && (
            <p className="whitespace-pre-line text-ink-600 dark:text-ink-300">
              {place.summary ?? place.description}
            </p>
          )}

          {/* Vibes */}
          {place.vibes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="size-4 text-ink-400" />
              {place.vibes.map((vibe) => (
                <span
                  key={vibe}
                  className="rounded-full bg-gulf-50 px-3 py-1 text-xs font-medium text-gulf-700 dark:bg-gulf-700/30 dark:text-gulf-200"
                >
                  {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          )}

          {/* Details grid */}
          <div className="grid gap-4 rounded-card border border-ink-100 bg-sand-50/50 p-5 sm:grid-cols-2 dark:border-ink-700 dark:bg-ink-800/50">
            {place.address && (
              <div className="flex items-start gap-3 text-sm text-ink-600 dark:text-ink-300">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span>{place.address}</span>
              </div>
            )}
            {place.phoneNumber && (
              <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Phone className="size-4 shrink-0 text-ink-400" />
                <a
                  href={`tel:${place.phoneNumber}`}
                  className="relative z-20 underline-offset-2 hover:underline"
                >
                  {place.phoneNumber}
                </a>
              </div>
            )}
            {place.websiteUrl && (
              <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Globe className="size-4 shrink-0 text-ink-400" />
                <a
                  href={place.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-20 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  Visit website
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
            {hours.length > 0 && (
              <div className="flex items-start gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Clock className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <div className="flex flex-col gap-0.5">
                  {hours.map((h, i) => (
                    <span key={i}>{h}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source link */}
          <a
            href={place.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline dark:text-ink-300 dark:hover:text-sand-50"
          >
            <ExternalLink className="size-4" />
            View on source
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function parseHoursJson(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((h): h is string => typeof h === "string");
  return [];
}
