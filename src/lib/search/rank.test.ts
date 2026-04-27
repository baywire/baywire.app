import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSearchQuery, rankDeterministic, tokenizeSearchQuery } from "@/lib/search/rank";
import type { AppEvent } from "@/lib/events/types";

function mkEvent(overrides: Partial<AppEvent>): AppEvent {
  const now = new Date("2026-04-27T18:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    canonicalId: null,
    sourceId: "22222222-2222-4222-8222-222222222222",
    sourceEventId: "source-1",
    title: "Tampa Riverfest",
    description: "Live music and food along the river.",
    startAt: now,
    endAt: null,
    allDay: false,
    venueName: "Curtis Hixon Waterfront Park",
    address: "600 N Ashley Dr, Tampa, FL",
    city: "tampa",
    lat: null,
    lng: null,
    priceMin: null,
    priceMax: null,
    isFree: true,
    categories: ["music", "festival", "food"],
    imageUrl: null,
    eventUrl: "https://example.com/event",
    contentHash: "hash-1",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    editorialScore: 0.9,
    ...overrides,
  } as AppEvent;
}

test("normalizeSearchQuery compacts whitespace and lowercases", () => {
  assert.equal(normalizeSearchQuery("  Live   Music  "), "live music");
  assert.deepEqual(tokenizeSearchQuery(" live   music "), ["live", "music"]);
});

test("rankDeterministic prioritizes title and venue relevance", () => {
  const events = [
    mkEvent({ id: "11111111-1111-4111-8111-111111111111", title: "Tampa Riverfest" }),
    mkEvent({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Downtown Comedy Night",
      description: "Stand-up at Curtis Hixon Waterfront Park.",
      categories: ["comedy"],
      editorialScore: 0.5,
    }),
  ];
  const ranked = rankDeterministic(events, "riverfest");
  assert.equal(ranked[0]?.eventID, "11111111-1111-4111-8111-111111111111");
});

test("rankDeterministic returns empty for tiny or unmatched query", () => {
  const events = [mkEvent({})];
  assert.deepEqual(rankDeterministic(events, "a"), []);
  assert.deepEqual(rankDeterministic(events, "quantum quilting"), []);
});
