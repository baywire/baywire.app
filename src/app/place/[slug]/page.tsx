import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink as ExternalLinkIcon, Globe, MapPin, Phone, Tag as TagIcon } from "lucide-react";

import type { Metadata } from "next";

import { Callout, Chip, Heading, MetaRow, Tag, Text, TextLink, navLinkClass } from "@/design-system";
import { cn } from "@/lib/utils";
import { PlaceDetailHeroImage } from "@/components/PlaceDetailHeroImage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CATEGORY_LABELS, VIBE_LABELS } from "@/lib/places/labels";
import { cityLabel } from "@/lib/cities";
import { getPlaceBySlug } from "@/lib/db/queriesPlaces";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(() => null);
  if (!place) return { title: "Place not found" };
  return {
    title: `${place.name} — Baywire`,
    description:
      place.summary ?? place.description ?? `${place.name} in ${cityLabel(place.city)}.`,
    openGraph: {
      title: place.name,
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

  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";
  const city = cityLabel(place.city);
  const hours = parseHoursJson(place.hoursJson);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <TextLink href={"/places" as Route} className="inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" />
          Back to places
        </TextLink>

        <div className="mt-6 flex flex-col gap-6">
          <PlaceDetailHeroImage imageUrl={place.imageUrl} name={place.name} categoryLabel={categoryLabel} />

          <MetaRow>
            <Chip tone="gulf" icon={<MapPin className="size-3" />}>{city}</Chip>
            <Chip tone="sunset">{categoryLabel}</Chip>
            {place.priceRange && <Chip tone="sand">{place.priceRange}</Chip>}
          </MetaRow>

          <Heading level="page" className="font-bold sm:text-4xl">
            {place.name}
          </Heading>

          {place.whyItsCool && (
            <Callout>
              <span className="font-semibold text-gulf-700 dark:text-gulf-200">
                Why this pick:
              </span>{" "}
              {place.whyItsCool}
            </Callout>
          )}

          {(place.summary ?? place.description) && (
            <Text variant="prose">
              {place.summary ?? place.description}
            </Text>
          )}

          {place.vibes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <TagIcon className="size-4 text-ink-400" />
              {place.vibes.map((vibe) => (
                <Tag key={vibe}>
                  {VIBE_LABELS[vibe] ?? vibe.replaceAll("_", " ")}
                </Tag>
              ))}
            </div>
          )}

          <div className="grid gap-4 rounded-card border border-ink-100 bg-sand-50/50 p-5 sm:grid-cols-2 dark:border-ink-700 dark:bg-ink-800/50">
            {place.address && (
              <Text variant="default" as="div" className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span>{place.address}</span>
              </Text>
            )}
            {place.phoneNumber && (
              <Text variant="default" as="div" className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-ink-400" />
                <a
                  href={`tel:${place.phoneNumber}`}
                  className="relative z-20 underline-offset-2 hover:underline"
                >
                  {place.phoneNumber}
                </a>
              </Text>
            )}
            {place.websiteUrl && (
              <Text variant="default" as="div" className="flex items-center gap-3">
                <Globe className="size-4 shrink-0 text-ink-400" />
                <a
                  href={place.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-20 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  Visit website
                  <ExternalLinkIcon className="size-3" />
                </a>
              </Text>
            )}
            {hours.length > 0 && (
              <Text variant="default" as="div" className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <div className="flex flex-col gap-0.5">
                  {hours.map((h, i) => (
                    <span key={i}>{h}</span>
                  ))}
                </div>
              </Text>
            )}
          </div>

          <a
            href={place.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("inline-flex items-center gap-1.5 text-sm underline-offset-2 hover:underline", navLinkClass)}
          >
            <ExternalLinkIcon className="size-4" />
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
