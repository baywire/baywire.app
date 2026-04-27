"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Sparkles, X } from "lucide-react";

import { SearchResultRow } from "@/components/search/SearchResultRow";
import { useHome } from "@/components/home/homeState";
import { Button, IconButton } from "@/components/ui";

import type { SearchResponse } from "@/lib/search/types";

export function SearchDialog() {
  const {
    events,
    savedFromServer,
    topTags,
    savedIds,
    showSavedOnly,
    window: windowKey,
    selectedCity,
    freeOnly,
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
  } = useHome();
  const inputRef = useRef<HTMLInputElement>(null);
  const prevOverflow = useRef("");

  const byID = useMemo(() => {
    const out = new Map<string, (typeof events)[0]>();
    for (const event of events) out.set(event.id, event);
    for (const event of savedFromServer) {
      if (!out.has(event.id)) out.set(event.id, event);
    }
    return out;
  }, [events, savedFromServer]);

  const aiPicks = useMemo(
    () => (searchResponse?.aiPickIDs ?? [])
      .map((id) => byID.get(id))
      .filter((event): event is NonNullable<typeof event> => Boolean(event)),
    [byID, searchResponse],
  );

  const directMatches = useMemo(() => {
    const aiSet = new Set(aiPicks.map((event) => event.id));
    return (searchResponse?.directMatchIDs ?? [])
      .filter((id) => !aiSet.has(id))
      .map((id) => byID.get(id))
      .filter((event): event is NonNullable<typeof event> => Boolean(event));
  }, [aiPicks, byID, searchResponse]);

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
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchMode("loading");
      try {
        const params = new URLSearchParams({
          q: normalized,
          window: windowKey,
          city: selectedCity,
          free: String(freeOnly),
          tags: Array.from(topTags).sort((a, b) => a.localeCompare(b)).join(","),
          savedOnly: String(showSavedOnly),
          savedIDs: showSavedOnly ? Array.from(savedIds).join(",") : "",
        });
        const response = await fetch(`/api/search?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const payload = await response.json() as SearchResponse;
        setSearchResponse(payload);
        setSearchMode(payload.metadata.mode);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("search request failed", err);
        setSearchResponse(null);
        setSearchMode("error");
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    freeOnly,
    isSearchOpen,
    savedIds,
    searchQuery,
    selectedCity,
    setSearchMode,
    setSearchResponse,
    showSavedOnly,
    topTags,
    windowKey,
  ]);

  if (!isSearchOpen || typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const totalResults = aiPicks.length + directMatches.length;
  const hasResults = totalResults > 0;
  const queryReady = searchQuery.trim().length >= 2;
  const showEmpty = searchMode !== "loading" && queryReady && !hasResults;
  const intentLine = searchResponse?.intentLine;

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
        aria-label="Search events"
        className="relative z-121 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-100 bg-sand-50 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 dark:border-ink-700">
          <Search className="size-4 shrink-0 text-ink-400 dark:text-ink-400" />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search events, venues, or tags"
            className="w-full min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400 dark:text-sand-50 dark:placeholder:text-ink-500"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResponse(null);
                setSearchMode("idle");
                inputRef.current?.focus();
              }}
              className="shrink-0 text-xs text-ink-400 transition hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
            >
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

        {/* Status / intent */}
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

        {/* Results */}
        <div className="max-h-[min(70dvh,40rem)] overflow-y-auto overscroll-contain">
          {aiPicks.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gulf-600 dark:text-gulf-300">
                <Sparkles className="size-3" />
                AI Picks
              </h3>
              {aiPicks.map((event) => (
                <SearchResultRow
                  key={event.id}
                  event={event}
                  reason={searchResponse?.reasonByID[event.id]}
                  initialInPlan={planOrder.includes(event.id)}
                />
              ))}
            </div>
          )}

          {directMatches.length > 0 ? (
            <div className="px-4 pt-3 pb-1">
              {aiPicks.length > 0 && (
                <div className="mb-2 border-t border-ink-100 dark:border-ink-700" />
              )}
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-400">
                More results
              </h3>
              {directMatches.slice(0, 20).map((event) => (
                <SearchResultRow
                  key={event.id}
                  event={event}
                  initialInPlan={planOrder.includes(event.id)}
                />
              ))}
            </div>
          ) : aiPicks.length > 0 && searchMode !== "loading" && (
            <div className="border-t border-ink-100 px-4 py-3 dark:border-ink-700">
              <p className="text-center text-xs text-ink-400 dark:text-ink-500">
                All matching events curated above
              </p>
            </div>
          )}

          {showEmpty && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-500 dark:text-ink-300">
                No events match &ldquo;{searchQuery.trim()}&rdquo;
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResponse(null);
                    setSearchMode("idle");
                    inputRef.current?.focus();
                  }}
                >
                  Clear search
                </Button>
              </div>
            </div>
          )}

          {!queryReady && (
            <div className="px-4 py-8 text-center text-xs text-ink-400 dark:text-ink-400">
              Type to search events, venues, or tags.
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
