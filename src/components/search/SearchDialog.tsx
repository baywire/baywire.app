"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPin, Search, Sparkles, X } from "lucide-react";

import { SearchResultRow } from "@/components/search/SearchResultRow";
import { SearchPlaceResultRow } from "@/components/search/SearchPlaceResultRow";
import { useHomePlan } from "@/components/plan/homePlanContext";
import { Button, IconButton } from "@/components/ui";

import { search } from "@/lib/search/actions";

export function SearchDialog() {
  const {
    planOrder,
    isSearchOpen,
    openSearch,
    closeSearch,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    searchResponse,
    setSearchResponse,
  } = useHomePlan();

  const inputRef = useRef<HTMLInputElement>(null);
  const prevOverflow = useRef("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isSearchOpen) {
        closeSearch();
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (isTextInput) return;
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        openSearch();
      }
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeSearch, isSearchOpen, openSearch]);

  useEffect(() => {
    if (!isSearchOpen) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow.current;
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const normalized = searchQuery.trim();
    if (normalized.length < 2) {
      setSearchMode("idle");
      setSearchResponse(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setSearchMode("loading");
      try {
        const payload = await search({ query: normalized });
        if (cancelled) return;
        setSearchResponse(payload);
        setSearchMode(payload.metadata.mode);
      } catch (err) {
        if (cancelled) return;
        console.error("search request failed", err);
        setSearchResponse(null);
        setSearchMode("error");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isSearchOpen, searchQuery, setSearchMode, setSearchResponse]);

  if (!isSearchOpen || typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const aiPicks = searchResponse?.aiPicks ?? [];
  const events = searchResponse?.events ?? [];
  const places = searchResponse?.places ?? [];
  const totalResults = aiPicks.length + events.length + places.length;
  const hasResults = totalResults > 0;
  const queryReady = searchQuery.trim().length >= 2;
  const intentLine = searchResponse?.intentLine;

  const clearAll = () => {
    setSearchQuery("");
    setSearchResponse(null);
    setSearchMode("idle");
    inputRef.current?.focus();
  };

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-start justify-center p-3 sm:p-6 sm:pt-[8vh]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-[3px] dark:bg-black/70"
        aria-label="Close search"
        onClick={closeSearch}
      />
      <section
        role="dialog"
        aria-modal
        aria-label="Search events and places"
        className="relative z-121 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-100 bg-sand-50 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
      >
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 dark:border-ink-700">
          <Search className="size-4 shrink-0 text-ink-400 dark:text-ink-400" />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search events, places, or tags"
            className="w-full min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400 dark:text-sand-50 dark:placeholder:text-ink-500"
          />
          {searchQuery.length > 0 && (
            <button type="button" onClick={clearAll} className="shrink-0 text-xs text-ink-400 transition hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200">
              Clear
            </button>
          )}
          <IconButton
            type="button"
            surface="plain"
            onClick={closeSearch}
            aria-label="Close search"
            className="shrink-0 text-ink-400 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
          >
            <X className="size-4" />
          </IconButton>
        </div>

        {queryReady && (
          <div className="border-b border-ink-100 px-4 py-2 dark:border-ink-700">
            {searchMode === "loading" ? (
              <span className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-400">
                <Loader2 className="size-3 animate-spin" />
                Searching...
              </span>
            ) : intentLine ? (
              <span className="flex items-center gap-1.5 text-xs text-gulf-600 dark:text-gulf-300">
                <Sparkles className="size-3 shrink-0" />
                {intentLine}
              </span>
            ) : hasResults ? (
              <span className="text-xs text-ink-400 dark:text-ink-400">
                {totalResults} result{totalResults === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        )}

        <div className="max-h-[min(70dvh,40rem)] overflow-y-auto overscroll-contain">
          {aiPicks.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gulf-600 dark:text-gulf-300">
                <Sparkles className="size-3" />
                AI Picks
              </h3>
              {aiPicks.map((pick) =>
                pick.type === "event" && pick.event ? (
                  <SearchResultRow
                    key={pick.event.id}
                    event={pick.event}
                    reason={pick.reason}
                    initialInPlan={planOrder.includes(pick.event.id)}
                  />
                ) : pick.type === "place" && pick.place ? (
                  <SearchPlaceResultRow
                    key={pick.place.id}
                    place={pick.place}
                    onClose={closeSearch}
                    reason={pick.reason}
                  />
                ) : null,
              )}
            </div>
          )}

          {events.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              {aiPicks.length > 0 && (
                <div className="mb-2 border-t border-ink-100 dark:border-ink-700" />
              )}
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-400">
                Events
              </h3>
              {events.slice(0, 20).map((event) => (
                <SearchResultRow
                  key={event.id}
                  event={event}
                  initialInPlan={planOrder.includes(event.id)}
                />
              ))}
            </div>
          )}

          {places.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              {(aiPicks.length > 0 || events.length > 0) && (
                <div className="mb-2 border-t border-ink-100 dark:border-ink-700" />
              )}
              <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-400">
                <MapPin className="size-3" />
                Places
              </h3>
              {places.slice(0, 10).map((place) => (
                <SearchPlaceResultRow key={place.id} place={place} onClose={closeSearch} />
              ))}
            </div>
          )}

          {!hasResults && searchMode !== "loading" && queryReady && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-500 dark:text-ink-300">
                No results match &ldquo;{searchQuery.trim()}&rdquo;
              </p>
              <div className="mt-3">
                <Button type="button" variant="ghost" onClick={clearAll}>
                  Clear search
                </Button>
              </div>
            </div>
          )}

          {!queryReady && (
            <div className="px-4 py-8 text-center text-xs text-ink-400 dark:text-ink-400">
              Type to search events, places, or tags.
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
