"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { CityFilter } from "@/components/CityFilter";
import {
  HomeStateProvider,
  useHome,
  type HomeContextValue,
} from "@/components/home/homeState";
import { TopTagFilter } from "@/components/TopTagFilter";

import type { Event } from "@/generated/prisma/client";

import { setSavedEventIdsCookie, setTopTagsCookie } from "@/lib/cookies/browser";
import { useHomePlan } from "@/components/plan/homePlanContext";
import type { CityKey } from "@/lib/cities";
import { eventMatchesTopTags, type TagOption } from "@/lib/events/tagOptions";
import type { WindowKey } from "@/lib/time/window";

interface HomeProviderProps {
  children: ReactNode;
  events: Event[];
  tagOptions: TagOption[];
  initialTopTags: string[];
  initialSavedIds: string[];
  savedFromServer: Event[];
  window: WindowKey;
}

export function HomeProvider({
  children,
  events,
  tagOptions,
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

  useEffect(() => {
    setTopTagsCookie([...topTags]);
  }, [topTags]);

  useEffect(() => {
    setSavedEventIdsCookie([...savedIds]);
  }, [savedIds]);

  const toggleSaved = useCallback((e: Event) => {
    setSavedIds((prev) => {
      const n = new Set(prev);
      if (n.has(e.id)) n.delete(e.id);
      else n.add(e.id);
      return n;
    });
  }, []);

  const filtered = useMemo(
    () => events.filter((e) => eventMatchesTopTags(e, topTags)),
    [events, topTags],
  );

  const value = useMemo<HomeContextValue>(
    () => ({
      events,
      savedFromServer,
      window,
      topTags,
      setTopTags,
      savedIds,
      toggleSaved,
      filtered,
      planOrder,
      togglePlan,
    }),
    [events, savedFromServer, window, topTags, savedIds, toggleSaved, filtered, planOrder, togglePlan],
  );

  return <HomeStateProvider value={value}>{children}</HomeStateProvider>;
}

interface HomeFilterRowProps {
  selected: CityKey | "all";
  facets: Record<string, number>;
  tagOptions: TagOption[];
}

export function HomeFilterRow({ selected, facets, tagOptions }: HomeFilterRowProps) {
  const { topTags, setTopTags } = useHome();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
      <CityFilter selected={selected} facets={facets} />
      {tagOptions.length > 0 && (
        <TopTagFilter options={tagOptions} selected={topTags} onChange={setTopTags} />
      )}
    </div>
  );
}
