"use client";

import { useCallback, useMemo, useState } from "react";

import { AlertTriangle, ChevronDown, ChevronUp, Clock, ListOrdered, MapPin, Tag, Trash2 } from "lucide-react";
import Image from "next/image";

import { EmptyState } from "@/components/EmptyState";
import { EventDialog } from "@/components/event/EventDialog";
import { useHomePlan } from "@/components/plan/homePlanContext";

import type { AppEvent } from "@/lib/events/types";

import { groupEventsByDay, type DayGroup } from "@/lib/events/grouping";
import { findConflictMap } from "@/lib/plan/intervals";
import { cityLabel } from "@/lib/cities";
import { formatTimeRange } from "@/lib/time/window";
import { cn, formatPrice } from "@/lib/utils";

function groupPlanEvents(ordered: AppEvent[]): DayGroup[] {
  return groupEventsByDay(ordered);
}

export function PlanView() {
  const { planOrder, setPlanOrder, planEventsById } = useHomePlan();
  const [viewer, setViewer] = useState<AppEvent | null>(null);

  const ordered = useMemo(
    () =>
      planOrder
        .map((id) => planEventsById.get(id))
        .filter((e): e is AppEvent => e != null),
    [planOrder, planEventsById],
  );

  const conflictMap = useMemo(() => findConflictMap(ordered), [ordered]);

  const groups = useMemo(() => groupPlanEvents(ordered), [ordered]);

  const globalIndex = useMemo(() => {
    const m = new Map<string, number>();
    planOrder.forEach((id, i) => m.set(id, i));
    return m;
  }, [planOrder]);

  const canSwap = useCallback(
    (id: string, neighborId: string) => {
      const a = planEventsById.get(id);
      const b = planEventsById.get(neighborId);
      if (!a || !b) return true;
      if (a.allDay || b.allDay) return true;
      const aIdx = globalIndex.get(id) ?? 0;
      const bIdx = globalIndex.get(neighborId) ?? 0;
      const movingUp = aIdx > bIdx;
      if (movingUp) return a.startAt.getTime() <= b.startAt.getTime();
      return a.startAt.getTime() >= b.startAt.getTime();
    },
    [planEventsById, globalIndex],
  );

  const swap = useCallback((idA: string, idB: string) => {
    setPlanOrder((o) => {
      const iA = o.indexOf(idA);
      const iB = o.indexOf(idB);
      if (iA < 0 || iB < 0) return o;
      const c = [...o];
      [c[iA], c[iB]] = [c[iB]!, c[iA]!];
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
      <EmptyState
        title="Your plan is empty"
        description="Build your perfect day by adding events you're interested in."
        icon={ListOrdered}
        dashed={false}
        actions={
          <ol className="w-full max-w-xs space-y-3 text-left text-sm text-ink-600 dark:text-ink-300">
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gulf-50 text-xs font-bold text-gulf-600 dark:bg-gulf-700/40 dark:text-gulf-100">
                1
              </span>
              <span>
                Tap the{" "}
                <span className="inline-flex translate-y-0.5 items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 font-medium text-ink-700 dark:bg-ink-700 dark:text-ink-200">
                  <ListOrdered className="size-3.5" />
                </span>{" "}
                icon on any event card
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gulf-50 text-xs font-bold text-gulf-600 dark:bg-gulf-700/40 dark:text-gulf-100">
                2
              </span>
              <span>Rearrange your day and check for conflicts</span>
            </li>
          </ol>
        }
      />
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
                const gIdx = globalIndex.get(e.id) ?? 0;
                const upId = gIdx > 0 ? planOrder[gIdx - 1]! : undefined;
                const downId = gIdx < planOrder.length - 1 ? planOrder[gIdx + 1]! : undefined;
                return (
                  <li key={e.id}>
                    <PlanEventRow
                      event={e}
                      conflictsWith={conflictMap.get(e.id) ?? []}
                      canUp={!!upId && canSwap(e.id, upId)}
                      canDown={!!downId && canSwap(e.id, downId)}
                      onUp={() => upId && swap(e.id, upId)}
                      onDown={() => downId && swap(e.id, downId)}
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
  const city = cityLabel(event.city);
  const price = formatPrice(event.priceMin, event.priceMax, event.isFree);
  const hasConflict = conflictsWith.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-ink-100 bg-white transition dark:border-ink-700 dark:bg-ink-900/80",
        hasConflict && "border-sunset-300/80 ring-1 ring-sunset-200/60 dark:border-sunset-500/50 dark:ring-sunset-500/30",
      )}
    >
      <button
        type="button"
        onClick={onViewDetails}
        className="flex w-full items-start gap-3 rounded-t-lg px-3 py-2.5 text-left transition hover:bg-ink-50/60 dark:hover:bg-ink-800/40"
      >
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div
              aria-hidden
              className="flex size-full items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500"
            >
              <span className="font-display text-[10px] font-semibold uppercase tracking-tight">
                {city.replace(/[^A-Za-z]/g, "").slice(0, 3)}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900 dark:text-sand-50">
            {event.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500 dark:text-ink-300">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {time}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {event.venueName ?? city}
            </span>
            {price && (
              <span className={event.isFree ? "font-medium text-emerald-600 dark:text-emerald-300" : ""}>
                {price}
              </span>
            )}
          </p>
          {event.categories.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <Tag className="size-2.5 text-ink-400" />
              {event.categories.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] capitalize text-ink-600 dark:bg-ink-700/60 dark:text-ink-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {hasConflict && (
        <div className="border-t border-ink-100 px-3 py-1.5 dark:border-ink-700">
          <ConflictNote conflictsWith={conflictsWith} />
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-ink-100 px-2 py-1.5 dark:border-ink-700">
        <button
          type="button"
          onClick={onUp}
          disabled={!canUp}
          className="flex size-7 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-ink-800 dark:text-ink-300"
          aria-label="Move up in plan"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={!canDown}
          className="flex size-7 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-ink-800 dark:text-ink-300"
          aria-label="Move down in plan"
        >
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto flex size-7 items-center justify-center rounded text-ink-400 hover:bg-sunset-50 hover:text-sunset-600 dark:hover:bg-sunset-500/10 dark:hover:text-sunset-300"
          aria-label="Remove from plan"
        >
          <Trash2 className="size-3.5" />
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
