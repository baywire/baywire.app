import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { TextLink } from "@/design-system";
import { EventDetailBody } from "@/components/event/EventDetailBody";
import { AddToPlanButton } from "@/components/plan/AddToPlanButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import { COOKIE_PLAN } from "@/lib/cookies/constants";
import { parsePlanOrderCookie } from "@/lib/cookies/parse";
import { cityLabel } from "@/lib/cities";
import { getEventById } from "@/lib/db/queries";

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

  const jar = await cookies();
  const initialInPlan = parsePlanOrderCookie(jar.get(COOKIE_PLAN)?.value).includes(id);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TextLink href="/" className="inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft className="size-4" />
            Back to events
          </TextLink>
          <AddToPlanButton event={event} initialInPlan={initialInPlan} />
        </div>

        <div className="mt-6">
          <EventDetailBody event={event} priorityImage />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
