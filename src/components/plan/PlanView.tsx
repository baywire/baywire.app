"use client";

import { useCallback, useMemo, useState } from "react";

import { AlertTriangle, ChevronDown, ChevronUp, Clock, ListOrdered, MapPin, Tag as TagIcon, Trash2 } from "lucide-react";

import { Chip, EmptyState, Heading, IconButton, Tag, Text } from "@/design-system";
import { EventDialog } from "@/components/event/EventDialog";
import { PlaceDialog } from "@/components/place/PlaceDialog";
import { FallbackImage } from "@/components/FallbackImage";
import { useHomePlan } from "@/components/plan/homePlanContext";

import type { AppEvent } from "@/lib/events/types";
import type { AppPlace } from "@/lib/places/types";

import { findConflictMap } from "@/lib/plan/intervals";
import { CATEGORY_LABELS } from "@/lib/places/labels";
import { cityLabel } from "@/lib/cities";
import { formatDayHeader, formatTimeRange, TZ } from "@/lib/time/window";
import { cn, formatPrice } from "@/lib/utils";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type PlanItem =
  | { type: "event"; data: AppEvent }
  | { type: "place"; data: AppPlace };

export function PlanView() {
  const { planOrder, setPlanOrder, planEventsById, planPlacesById } = useHomePlan();
  const [eventViewer, setEventViewer] = useState<AppEvent | null>(null);
  const [placeViewer, setPlaceViewer] = useState<AppPlace | null>(null);

  const items = useMemo<PlanItem[]>(() => {
    const out: PlanItem[] = [];
    for (const id of planOrder) {
      const evt = planEventsById.get(id);
      if (evt) { out.push({ type: "event", data: evt }); continue; }
      const plc = planPlacesById.get(id);
      if (plc) { out.push({ type: "place", data: plc }); }
    }
    return out;
  }, [planOrder, planEventsById, planPlacesById]);

  const orderedEvents = useMemo(
    () => items.filter((i): i is PlanItem & { type: "event" } => i.type === "event").map((i) => i.data),
    [items],
  );

  const conflictMap = useMemo(() => findConflictMap(orderedEvents), [orderedEvents]);

  const canSwap = useCallback(
    (idx: number, neighborIdx: number) => {
      const a = items[idx];
      const b = items[neighborIdx];
      if (!a || !b) return true;
      if (a.type === "place" || b.type === "place") return true;
      const ae = a.data;
      const be = b.data;
      if (ae.allDay || be.allDay) return true;
      const movingUp = idx > neighborIdx;
      if (movingUp) return ae.startAt.getTime() <= be.startAt.getTime();
      return ae.startAt.getTime() >= be.startAt.getTime();
    },
    [items],
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

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your plan is empty"
        description="Build your perfect day by adding events and places you're interested in."
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
                icon on any event or place card
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

  const conflictCountByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of orderedEvents) {
      if (!conflictMap.has(e.id)) continue;
      const dk = dayKeyFmt.format(e.startAt);
      m.set(dk, (m.get(dk) ?? 0) + 1);
    }
    return m;
  }, [orderedEvents, conflictMap]);

  const rendered = useMemo(() => {
    const out: React.ReactNode[] = [];
    let lastDayKey: string | null = null;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]!;
      const id = item.data.id;

      if (item.type === "event") {
        const dk = dayKeyFmt.format(item.data.startAt);
        if (dk !== lastDayKey) {
          const conflictsOnDay = conflictCountByDay.get(dk) ?? 0;
          out.push(
            <li key={`day-${dk}`} className="pt-4 first:pt-0" aria-hidden="false">
              <div className="border-b border-ink-200/80 pb-2 dark:border-ink-600/80">
                <Heading level="section">{formatDayHeader(item.data.startAt)}</Heading>
                {conflictsOnDay > 0 && (
                  <p className="mt-1 text-sm font-medium text-sunset-600 dark:text-sunset-300">
                    {conflictsOnDay} event{conflictsOnDay === 1 ? "" : "s"} on this day overlap in time.
                  </p>
                )}
              </div>
            </li>,
          );
          lastDayKey = dk;
        }
      }

      const upOk = idx > 0 && canSwap(idx, idx - 1);
      const downOk = idx < items.length - 1 && canSwap(idx, idx + 1);
      const upId = idx > 0 ? items[idx - 1]!.data.id : undefined;
      const downId = idx < items.length - 1 ? items[idx + 1]!.data.id : undefined;

      if (item.type === "event") {
        out.push(
          <li key={id}>
            <PlanEventRow
              event={item.data}
              conflictsWith={conflictMap.get(id) ?? []}
              canUp={!!upId && upOk}
              canDown={!!downId && downOk}
              onUp={() => upId && swap(id, upId)}
              onDown={() => downId && swap(id, downId)}
              onRemove={() => remove(id)}
              onViewDetails={() => setEventViewer(item.data)}
            />
          </li>,
        );
      } else {
        out.push(
          <li key={id}>
            <PlanPlaceRow
              place={item.data}
              canUp={!!upId && upOk}
              canDown={!!downId && downOk}
              onUp={() => upId && swap(id, upId)}
              onDown={() => downId && swap(id, downId)}
              onRemove={() => remove(id)}
              onViewDetails={() => setPlaceViewer(item.data)}
            />
          </li>,
        );
      }
    }
    return out;
  }, [items, canSwap, swap, remove, conflictMap, conflictCountByDay, setEventViewer, setPlaceViewer]);

  return (
    <div className="space-y-2">
      <ul className="space-y-3">
        {rendered}
      </ul>

      {eventViewer && (
        <EventDialog
          event={eventViewer}
          open
          onClose={() => setEventViewer(null)}
          initialInPlan={planOrder.includes(eventViewer.id)}
        />
      )}

      {placeViewer && (
        <PlaceDialog
          place={placeViewer}
          open
          onClose={() => setPlaceViewer(null)}
          initialInPlan
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
        <PlanEventThumb imageUrl={event.imageUrl} city={city} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900 dark:text-sand-50">
            {event.title}
          </p>
          <Text variant="meta" as="p" className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
          </Text>
          {event.categories.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <TagIcon className="size-2.5 text-ink-400" />
              {event.categories.slice(0, 3).map((tag) => (
                <Tag key={tag} size="xs">{tag}</Tag>
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
        <IconButton
          size="sm"
          surface="plain"
          onClick={onUp}
          disabled={!canUp}
          className="rounded text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-ink-800 dark:text-ink-300"
          aria-label="Move up in plan"
        >
          <ChevronUp className="size-4" />
        </IconButton>
        <IconButton
          size="sm"
          surface="plain"
          onClick={onDown}
          disabled={!canDown}
          className="rounded text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-ink-800 dark:text-ink-300"
          aria-label="Move down in plan"
        >
          <ChevronDown className="size-4" />
        </IconButton>
        <IconButton
          size="sm"
          surface="plain"
          onClick={onRemove}
          className="ml-auto rounded text-ink-400 hover:bg-sunset-50 hover:text-sunset-600 dark:hover:bg-sunset-500/10 dark:hover:text-sunset-300"
          aria-label="Remove from plan"
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function PlanPlaceRow({
  place,
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
  onViewDetails,
}: {
  place: AppPlace;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onViewDetails: () => void;
}) {
  const city = cityLabel(place.city);
  const categoryLabel = CATEGORY_LABELS[place.category] ?? "Place";

  return (
    <div className="rounded-lg border border-ink-100 bg-white transition dark:border-ink-700 dark:bg-ink-900/80">
      <button
        type="button"
        onClick={onViewDetails}
        className="flex w-full items-start gap-3 rounded-t-lg px-3 py-2.5 text-left transition hover:bg-ink-50/60 dark:hover:bg-ink-800/40"
      >
        <PlanPlaceThumb imageUrl={place.imageUrl} category={categoryLabel} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900 dark:text-sand-50">
            {place.name}
          </p>
          <Text variant="meta" as="p" className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {place.address ?? city}
            </span>
          </Text>
          <div className="mt-1 flex items-center gap-1.5">
            <Chip tone="sunset" className="text-[10px]">{categoryLabel}</Chip>
            {place.priceRange && <Chip tone="sand" className="text-[10px]">{place.priceRange}</Chip>}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 border-t border-ink-100 px-2 py-1.5 dark:border-ink-700">
        <IconButton
          size="sm"
          surface="plain"
          onClick={onUp}
          disabled={!canUp}
          className="rounded text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-ink-800 dark:text-ink-300"
          aria-label="Move up in plan"
        >
          <ChevronUp className="size-4" />
        </IconButton>
        <IconButton
          size="sm"
          surface="plain"
          onClick={onDown}
          disabled={!canDown}
          className="rounded text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-ink-800 dark:text-ink-300"
          aria-label="Move down in plan"
        >
          <ChevronDown className="size-4" />
        </IconButton>
        <IconButton
          size="sm"
          surface="plain"
          onClick={onRemove}
          className="ml-auto rounded text-ink-400 hover:bg-sunset-50 hover:text-sunset-600 dark:hover:bg-sunset-500/10 dark:hover:text-sunset-300"
          aria-label="Remove from plan"
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function PlanPlaceThumb({ imageUrl, category }: { imageUrl: string | null; category: string }) {
  const placeholder = (
    <div
      aria-hidden
      className="flex size-full items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500"
    >
      <MapPin className="size-4" />
    </div>
  );
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
      {imageUrl ? (
        <FallbackImage
          src={imageUrl}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
          fallback={placeholder}
        />
      ) : (
        placeholder
      )}
    </div>
  );
}

function PlanEventThumbPlaceholder({ city }: { city: string }) {
  return (
    <div
      aria-hidden
      className="flex size-full items-center justify-center bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 text-ink-500"
    >
      <span className="font-display text-[10px] font-semibold uppercase tracking-tight">
        {city.replace(/[^A-Za-z]/g, "").slice(0, 3)}
      </span>
    </div>
  );
}

function PlanEventThumb({ imageUrl, city }: { imageUrl: string | null; city: string }) {
  const placeholder = <PlanEventThumbPlaceholder city={city} />;
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
      {imageUrl ? (
        <FallbackImage
          src={imageUrl}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
          fallback={placeholder}
        />
      ) : (
        placeholder
      )}
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
