"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AppPlace, PlaceCategoryValue } from "@/lib/places/types";
import type { CityKey } from "@/lib/cities";

export interface PlacesContextValue {
  places: AppPlace[];
  category: PlaceCategoryValue | "all";
  setCategory: (v: PlaceCategoryValue | "all") => void;
  selectedCity: CityKey | "all";
  selectedVibes: Set<string>;
  toggleVibe: (v: string) => void;
  clearVibes: () => void;
  filtered: AppPlace[];
}

const PlacesContext = createContext<PlacesContextValue | null>(null);

export function usePlaces(): PlacesContextValue {
  const v = useContext(PlacesContext);
  if (!v) throw new Error("usePlaces must be used within PlacesProvider");
  return v;
}

interface PlacesProviderProps {
  children: ReactNode;
  places: AppPlace[];
  initialCity: CityKey | "all";
  initialCategory: PlaceCategoryValue | "all";
}

export function PlacesProvider({
  children,
  places,
  initialCity,
  initialCategory,
}: PlacesProviderProps) {
  const [category, setCategory] = useState<PlaceCategoryValue | "all">(initialCategory);
  const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set());

  const toggleVibe = useCallback((vibe: string) => {
    setSelectedVibes((prev) => {
      const next = new Set(prev);
      if (next.has(vibe)) next.delete(vibe);
      else next.add(vibe);
      return next;
    });
  }, []);

  const clearVibes = useCallback(() => setSelectedVibes(new Set()), []);

  const filtered = useMemo(() => {
    let list = places;
    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }
    if (selectedVibes.size > 0) {
      list = list.filter((p) => p.vibes.some((v) => selectedVibes.has(v)));
    }
    return list;
  }, [places, category, selectedVibes]);

  const value = useMemo<PlacesContextValue>(
    () => ({
      places,
      category,
      setCategory,
      selectedCity: initialCity,
      selectedVibes,
      toggleVibe,
      clearVibes,
      filtered,
    }),
    [places, category, initialCity, selectedVibes, toggleVibe, clearVibes, filtered],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}
