import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { EmptyState } from "@/components/EmptyState";
import { PlanView } from "@/components/plan/PlanView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import { COOKIE_PLAN } from "@/lib/cookies/constants";
import { parsePlanOrderCookie } from "@/lib/cookies/parse";
import { listUpcomingEventsByIds } from "@/lib/db/queries";
import { sortEventsByPlanOrder } from "@/lib/plan/order";

export const metadata: Metadata = {
  title: "My plan",
  description: "Your Tampa Bay event itinerary, stored in this browser.",
};

export default async function PlanPage() {
  const jar = await cookies();
  const raw = parsePlanOrderCookie(jar.get(COOKIE_PLAN)?.value);
  const upcoming = await listUpcomingEventsByIds(raw);
  const idSet = new Set(upcoming.map((e) => e.id));
  const orderIds = raw.filter((id) => idSet.has(id));
  const events = sortEventsByPlanOrder(orderIds, upcoming);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-ink-900 dark:text-sand-50">
          My plan
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
          Reorder for your route, watch for time overlaps, and open details for
          each event. The list is saved in this browser for 7 days.
        </p>

        {orderIds.length === 0 ? (
          <div className="mt-8 space-y-4">
            <EmptyState
              title="Your plan is empty"
              description="Add events from the home feed with the list icon on a card, then come back here to line up your day."
            />
            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-medium text-ink-800 shadow-sm transition hover:border-ink-300 dark:border-ink-600 dark:bg-ink-900/80 dark:text-sand-100 dark:hover:border-ink-500"
              >
                Browse events
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <PlanView orderIds={orderIds} events={events} />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
