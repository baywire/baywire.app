"use client";

import { useCallback, useMemo, useState } from "react";

import { AlertTriangle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { EventDialog } from "@/components/event/EventDialog";
import { useHomePlan } from "@/components/plan/homePlanContext";

import type { AppEvent } from "@/lib/events/types";

import { groupEventsByDay, type DayGroup } from "@/lib/events/grouping";
import { findConflictMap } from "@/lib/plan/intervals";
import { cityLabel } from "@/lib/cities";
import { formatTimeRange } from "@/lib/time/window";
import { cn } from "@/lib/utils";

interface PlanViewProps {
  /** In slide-in or mobile, empty-state “browse” can switch to events without navigation. */
  onBrowseEvents?: () => void;
}

function groupPlanEvents(ordered: AppEvent[]): DayGroup[] {
  return groupEventsByDay(ordered);
}

export function PlanView({ onBrowseEvents }: PlanViewProps) {
  const { planOrder, setPlanOrder, planEventsById } = useHomePlan();
  const [viewer, setViewer] = useState<AppEvent | null>(null);

  const ordered = useMemo(
    () =>
      planOrder
        .map((id) => planEventsById.get(id))
        .filter((e): e is AppEvent => e != null),
    [planOrder, planEventsById],
  );

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    planOrder.forEach((id, i) => m.set(id, i));
    return m;
  }, [planOrder]);

  const conflictMap = useMemo(() => findConflictMap(ordered), [ordered]);

  const groups = useMemo(() => groupPlanEvents(ordered), [ordered]);

  const move = useCallback((id: string, dir: "up" | "down") => {
    setPlanOrder((o) => {
      const i = o.indexOf(id);
      if (i < 0) return o;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= o.length) return o;
      const c = [...o];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  }, [setPlanOrder]);

  const remove = useCallback(
    (id: string) => {
      setPlanOrder((o) => o.filter((x) => x !== id));
    },
    [setPlanOrder],
  );

  if (planOrder.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Your plan is empty"
          description="Add events from the home feed, then build your day here again."
        />
        <div className="text-center">
          {onBrowseEvents ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onBrowseEvents}
            >
              Browse events
            </Button>
          ) : (
            <Link
              href="/"
              className={buttonClasses({ variant: "secondary", size: "md" })}
            >
              Browse events
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const conflictsOnDay = group.events.filter((e) => conflictMap.has(e.id)).length;

        return (
          <section key={group.key} aria-labelledby={`plan-day-${group.key}`}>
            <div className="border-b border-ink-200/80 pb-2 dark:border-ink-600/80">
              <h2
                id={`plan-day-${group.key}`}
                className="font-display text-2xl font-semibold text-ink-900 dark:text-sand-50"
              >
                {group.label}
              </h2>
              {conflictsOnDay > 0 && (
                <p className="mt-1 text-sm font-medium text-sunset-600 dark:text-sunset-300">
                  {conflictsOnDay} event{conflictsOnDay === 1 ? "" : "s"} on this day overlap in time — see details on each card below.
                </p>
              )}
            </div>
            <ul className="mt-4 space-y-3">
              {group.events.map((e) => {
                const gIdx = indexById.get(e.id) ?? 0;
                return (
                  <li key={e.id}>
                    <PlanEventRow
                      event={e}
                      conflictsWith={conflictMap.get(e.id) ?? []}
                      canUp={gIdx > 0}
                      canDown={gIdx < planOrder.length - 1}
                      onUp={() => move(e.id, "up")}
                      onDown={() => move(e.id, "down")}
                      onRemove={() => remove(e.id)}
                      onViewDetails={() => setViewer(e)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {viewer && (
        <EventDialog
          event={viewer}
          open
          onClose={() => setViewer(null)}
          initialInPlan={planOrder.includes(viewer.id)}
        />
      )}
    </div>
  );
}

function PlanEventRow({
  event,
  conflictsWith,
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
  onViewDetails,
}: {
  event: AppEvent;
  conflictsWith: AppEvent[];
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onViewDetails: () => void;
}) {
  const time = formatTimeRange(event.startAt, event.endAt, event.allDay);
  const hasConflict = conflictsWith.length > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-card border border-ink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink-700 dark:bg-ink-900/80",
        hasConflict && "border-sunset-300/80 ring-1 ring-sunset-200/60 dark:border-sunset-500/50 dark:ring-sunset-500/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gulf-600 dark:text-gulf-200">
          {time} · {cityLabel(event.city)}
        </p>
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-0.5 block w-full text-left font-display text-lg font-semibold text-ink-900 hover:text-gulf-600 dark:text-sand-50 dark:hover:text-gulf-200"
        >
          {event.title}
        </button>
        {hasConflict && (
          <ConflictNote conflictsWith={conflictsWith} />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-0.5">
        <button
          type="button"
          onClick={onUp}
          disabled={!canUp}
          className="flex size-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-ink-600 dark:hover:bg-ink-800/80 dark:text-ink-200"
          aria-label="Move up in plan"
        >
          <ChevronUp className="size-5" />
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={!canDown}
          className="flex size-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-ink-600 dark:hover:bg-ink-800/80 dark:text-ink-200"
          aria-label="Move down in plan"
        >
          <ChevronDown className="size-5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 flex size-9 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:border-sunset-300 hover:text-sunset-600 dark:border-ink-600 dark:hover:border-sunset-500 dark:hover:text-sunset-300"
          aria-label="Remove from plan"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ConflictNote({ conflictsWith }: { conflictsWith: AppEvent[] }) {
  const max = 2;
  const shown = conflictsWith.slice(0, max);
  const extra = conflictsWith.length - shown.length;

  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-sunset-600 dark:text-sunset-300">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        Overlaps{" "}
        {shown.map((c, i) => (
          <span key={c.id}>
            {i > 0 && (extra > 0 || i < shown.length - 1 ? ", " : " and ")}
            <span className="font-semibold">{c.title}</span>
            <span className="text-sunset-500/90 dark:text-sunset-300/80">
              {" "}
              ({formatTimeRange(c.startAt, c.endAt, c.allDay)})
            </span>
          </span>
        ))}
        {extra > 0 && (
          <>
            {" "}
            and {extra} other{extra === 1 ? "" : "s"}
          </>
        )}
      </span>
    </p>
  );
}
