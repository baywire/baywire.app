"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { CityFilter } from "@/components/CityFilter";
import {
  HomeStateProvider,
  useHome,
  type HomeContextValue,
} from "@/components/home/homeState";
import { TopTagFilter } from "@/components/TopTagFilter";
import { WindowToggle } from "@/components/WindowToggle";

import type { AppEvent } from "@/lib/events/types";

import { setSavedEventIdsCookie, setTopTagsCookie } from "@/lib/cookies/browser";
import { useHomePlan } from "@/components/plan/homePlanContext";
import type { CityKey } from "@/lib/cities";
import { eventMatchesTopTags, type TagOption } from "@/lib/events/tagOptions";
import type { WindowKey } from "@/lib/time/window";

interface HomeProviderProps {
  children: ReactNode;
  events: AppEvent[];
  initialTopTags: string[];
  initialSavedIds: string[];
  savedFromServer: AppEvent[];
  window: WindowKey;
}

export function HomeProvider({
  children,
  events,
  initialTopTags,
  initialSavedIds,
  savedFromServer,
  window,
}: HomeProviderProps) {
  const { planOrder, togglePlan } = useHomePlan();
  const [topTags, setTopTags] = useState<Set<string>>(
    () => new Set(initialTopTags.map((t) => t.toLowerCase())),
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(initialSavedIds));
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    setTopTagsCookie([...topTags]);
  }, [topTags]);

  useEffect(() => {
    setSavedEventIdsCookie([...savedIds]);
  }, [savedIds]);

  const toggleSaved = useCallback((e: AppEvent) => {
    setSavedIds((prev) => {
      const n = new Set(prev);
      if (n.has(e.id)) n.delete(e.id);
      else n.add(e.id);
      return n;
    });
  }, []);

  const { upcomingSavedCount, savedStartingWithin24hCount } = useMemo(() => {
    const m = new Map<string, AppEvent>();
    for (const e of events) m.set(e.id, e);
    for (const e of savedFromServer) m.set(e.id, e);
    const now = new Date();
    const t24 = now.getTime() + 24 * 60 * 60 * 1000;
    let up = 0;
    let soon = 0;
    for (const id of savedIds) {
      const e = m.get(id);
      if (e && e.startAt >= now && eventMatchesTopTags(e, topTags)) {
        up += 1;
        if (e.startAt.getTime() < t24) soon += 1;
      }
    }
    return { upcomingSavedCount: up, savedStartingWithin24hCount: soon };
  }, [events, savedFromServer, savedIds, topTags]);

  const filtered = useMemo(() => {
    const base = events.filter((e) => eventMatchesTopTags(e, topTags));
    if (!showSavedOnly || upcomingSavedCount === 0) return base;
    return base.filter((e) => savedIds.has(e.id));
  }, [events, topTags, showSavedOnly, savedIds, upcomingSavedCount]);

  const value = useMemo<HomeContextValue>(
    () => ({
      events,
      savedFromServer,
      window,
      topTags,
      setTopTags,
      savedIds,
      upcomingSavedCount,
      savedStartingWithin24hCount,
      toggleSaved,
      showSavedOnly,
      setShowSavedOnly,
      filtered,
      planOrder,
      togglePlan,
    }),
    [
      events,
      savedFromServer,
      window,
      topTags,
      savedIds,
      upcomingSavedCount,
      savedStartingWithin24hCount,
      toggleSaved,
      showSavedOnly,
      filtered,
      planOrder,
      togglePlan,
    ],
  );

  return <HomeStateProvider value={value}>{children}</HomeStateProvider>;
}

interface HomeFilterRowProps {
  window: WindowKey;
  selected: CityKey | "all";
  facets: Record<string, number>;
  tagOptions: TagOption[];
  showTags?: boolean;
}

export function HomeFilterRow({
  window: windowKey,
  selected,
  facets,
  tagOptions,
  showTags = true,
}: HomeFilterRowProps) {
  const {
    topTags,
    setTopTags,
    upcomingSavedCount,
    showSavedOnly,
    setShowSavedOnly,
    savedIds,
  } = useHome();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3">
      <WindowToggle
        selected={windowKey}
        savedCount={upcomingSavedCount}
        showSavedOnly={showSavedOnly}
        onExitSavedMode={() => setShowSavedOnly(false)}
        onToggleSaved={() => setShowSavedOnly(!showSavedOnly)}
      />
      <CityFilter selected={selected} facets={facets} />
      {showTags && tagOptions.length > 0 && (
        <TopTagFilter options={tagOptions} selected={topTags} onChange={setTopTags} />
      )}
      {upcomingSavedCount === 0 && savedIds.size > 0 && (
        <p className="max-w-lg text-center text-sm leading-relaxed text-ink-600 dark:text-sand-200">
          Your shortlist has events, but nothing upcoming matches this view. Try a
          different time window, city, or fewer tags.
        </p>
      )}
    </div>
  );
}

interface HomeTagFilterRowProps {
  tagOptions: TagOption[];
}

export function HomeTagFilterRow({ tagOptions }: HomeTagFilterRowProps) {
  const { topTags, setTopTags } = useHome();
  if (tagOptions.length === 0) return null;
  return (
    <div className="mx-auto flex w-full flex-col items-center gap-3 ">
      <TopTagFilter options={tagOptions} selected={topTags} onChange={setTopTags} />
    </div>
  );
}
