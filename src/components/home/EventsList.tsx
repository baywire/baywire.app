"use client";

import { useMemo } from "react";

import { Bookmark } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { useHome } from "@/components/home/homeState";

import { eventMatchesTopTags } from "@/lib/events/tagOptions";
import { groupEventsByDay } from "@/lib/events/grouping";
import { getWindow } from "@/lib/time/window";

export function EventsList() {
  const {
    events,
    savedFromServer,
    window,
    topTags,
    savedIds,
    toggleSaved,
    filtered,
    planOrder,
    togglePlan,
    showSavedOnly,
    upcomingSavedCount,
    savedStartingWithin24hCount,
  } = useHome();

  const savedFilterActive = showSavedOnly && upcomingSavedCount > 0;

  const byId = useMemo(() => {
    const m = new Map<string, (typeof events)[0]>();
    for (const e of events) m.set(e.id, e);
    for (const e of savedFromServer) m.set(e.id, e);
    return m;
  }, [events, savedFromServer]);

  const savedUpcoming = useMemo(() => {
    const now = new Date();
    const out = [];
    for (const id of savedIds) {
      const e = byId.get(id);
      if (e && e.startAt >= now && eventMatchesTopTags(e, topTags)) {
        out.push(e);
      }
    }
    return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [byId, savedIds, topTags]);

  const windowMeta = getWindow(window);
  const groups = useMemo(() => groupEventsByDay(filtered), [filtered]);
  const featured = filtered[0];
  const showEmpty = filtered.length === 0;

  if (savedFilterActive) {
    return (
      <div id="saved-for-later" className="min-w-0 space-y-10 scroll-mt-28">
        {savedUpcoming.length > 0 ? (
          <section className="min-w-0" aria-labelledby="saved-heading">
            <h2
              id="saved-heading"
              className="font-display text-xl font-semibold text-ink-900 dark:text-sand-50"
            >
              <span className="inline-flex items-center gap-2">
                <Bookmark className="size-5 text-gulf-500" aria-hidden />
                Saved for later
              </span>
              <span className="ml-2 text-sm font-medium text-ink-500 dark:text-ink-300">
                (upcoming only)
              </span>
            </h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
              Shortlist to compare. Add to <span className="font-medium text-ink-700 dark:text-ink-200">My plan</span> when
              you’re ready to order your day. Stored in this browser for 7 days; past times drop off.
            </p>
            {savedStartingWithin24hCount > 0 && (
              <p className="mt-1 text-sm font-medium text-sunset-600 dark:text-sunset-300">
                {savedStartingWithin24hCount} starting within 24 hours — don’t snooze.
              </p>
            )}
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedUpcoming.map((e) => (
                <div key={e.id} className="min-w-0">
                  <EventCard
                    event={e}
                    bookmark={{ isSaved: true, onToggle: () => toggleSaved(e) }}
                    plan={{
                      inPlan: planOrder.includes(e.id),
                      onToggle: () => togglePlan(e),
                    }}
                    initialInPlan={planOrder.includes(e.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState
            title="No saved events in this view"
            description="Try turning off some tag picks, or switch the city or time window—your other saved events are still in your list with different filters."
          />
        )}
      </div>
    );
  }

  return (
    <div id="saved-for-later" className="min-w-0 space-y-10 scroll-mt-28">
      {showEmpty && (
        <EmptyState
          title="No events for those tags"
          description="Clear a few tags or try again — there may still be great picks under other tags this window."
        />
      )}

      {!showEmpty && featured && (
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-sand-50">
            Featured pick
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
            Our top hit for {windowMeta.label.toLowerCase()}
            {topTags.size > 0 ? " (among your tag picks)." : "."}
          </p>
          <div className="mt-4">
            <EventCard
              event={featured}
              variant="feature"
              bookmark={{
                isSaved: savedIds.has(featured.id),
                onToggle: () => toggleSaved(featured),
              }}
              plan={{
                inPlan: planOrder.includes(featured.id),
                onToggle: () => togglePlan(featured),
              }}
              initialInPlan={planOrder.includes(featured.id)}
            />
          </div>
        </div>
      )}

      {!showEmpty &&
        groups.map((group) => {
          const list = featured
            ? group.events.filter((e) => e.id !== featured.id)
            : group.events;
          if (list.length === 0) return null;
          return (
            <section className="min-w-0" key={group.key} aria-labelledby={`day-${group.key}`}>
              <h2
                id={`day-${group.key}`}
                className="sticky top-14 z-30 -mx-4 bg-sand-50/85 px-4 py-2 font-display text-xl font-semibold text-ink-900 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:text-2xl dark:bg-ink-900/80 dark:text-sand-50"
              >
                {group.label}
                <span className="ml-2 text-sm font-medium text-ink-500 dark:text-ink-300">
                  {list.length} event{list.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((event) => (
                  <div key={event.id} className="min-w-0">
                    <EventCard
                      event={event}
                      bookmark={{
                        isSaved: savedIds.has(event.id),
                        onToggle: () => toggleSaved(event),
                      }}
                      plan={{
                        inPlan: planOrder.includes(event.id),
                        onToggle: () => togglePlan(event),
                      }}
                      initialInPlan={planOrder.includes(event.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
