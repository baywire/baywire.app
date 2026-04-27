import assert from "node:assert/strict";
import test from "node:test";

import { buildCandidateEventWhere } from "@/lib/pipeline/canonicalWhere";

test("buildCandidateEventWhere filters to enabled sources", () => {
  const where = buildCandidateEventWhere({
    id: "evt_1",
    city: "tampa",
    allDay: false,
    startAt: new Date("2026-05-01T12:00:00.000Z"),
    endAt: null,
  });
  assert.deepEqual(where.source, { enabled: true });
});

test("buildCandidateEventWhere uses short-window OR for normal events", () => {
  const where = buildCandidateEventWhere({
    id: "evt_1",
    city: "tampa",
    allDay: false,
    startAt: new Date("2026-05-01T12:00:00.000Z"),
    endAt: new Date("2026-05-01T14:00:00.000Z"),
  });
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.startAt, undefined);
});

test("buildCandidateEventWhere uses long window for all-day events", () => {
  const where = buildCandidateEventWhere({
    id: "evt_1",
    city: "tampa",
    allDay: true,
    startAt: new Date("2026-05-01T12:00:00.000Z"),
    endAt: null,
  });
  assert.ok(where.startAt);
  assert.equal(where.OR, undefined);
});
