import test from "node:test";
import assert from "node:assert/strict";

import type { Event } from "@/generated/prisma/client";
import {
  isLikelySameEvent,
  normalizeMatchText,
  titleSimilarityScore,
} from "@/lib/pipeline/canonicalMatch";

function makeEvent(overrides: Partial<Event>): Event {
  const now = new Date("2026-05-01T19:00:00.000Z");
  return {
    id: "evt_1",
    canonicalId: null,
    sourceId: "src_1",
    sourceEventId: "source_evt_1",
    title: "Tampa Riverfest presented by Publix",
    description: null,
    startAt: now,
    endAt: null,
    allDay: false,
    venueName: "Curtis Hixon Park",
    address: "600 N Ashley Dr, Tampa, FL",
    city: "tampa",
    lat: null,
    lng: null,
    priceMin: null,
    priceMax: null,
    isFree: false,
    categories: [],
    imageUrl: null,
    eventUrl: "https://example.com",
    contentHash: "hash",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("normalizeMatchText removes punctuation and normalizes spaces", () => {
  assert.equal(normalizeMatchText(" Arts & Theatre: Live! "), "arts and theatre live");
});

test("titleSimilarityScore rewards near-substring matches", () => {
  const score = titleSimilarityScore(
    normalizeMatchText("tampa riverfest"),
    normalizeMatchText("tampa riverfest presented by publix"),
  );
  assert.ok(score >= 0.9);
});

test("isLikelySameEvent matches close time + title + venue", () => {
  const a = makeEvent({});
  const b = makeEvent({
    id: "evt_2",
    sourceId: "src_2",
    sourceEventId: "source_evt_2",
    title: "Tampa Riverfest",
    startAt: new Date("2026-05-01T20:00:00.000Z"),
  });
  assert.equal(isLikelySameEvent(a, b), true);
});

test("isLikelySameEvent matches all-day span to day-specific occurrence", () => {
  const spanning = makeEvent({
    id: "evt_span",
    title: "Tampa Riverfest",
    allDay: true,
    startAt: new Date("2026-05-01T07:00:00.000Z"),
    endAt: new Date("2026-05-03T06:59:59.000Z"),
  });
  const daySpecific = makeEvent({
    id: "evt_day",
    title: "Tampa Riverfest presented by Publix",
    allDay: false,
    startAt: new Date("2026-05-02T13:00:00.000Z"),
    endAt: null,
  });
  assert.equal(isLikelySameEvent(spanning, daySpecific), true);
});
