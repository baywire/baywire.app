import assert from "node:assert/strict";
import test from "node:test";

import { buildVisibleEventWhere } from "@/lib/db/eventWhere";

test("buildVisibleEventWhere always filters to enabled sources", () => {
  const where = buildVisibleEventWhere(
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-05-31T23:59:59.000Z"),
    {},
  );
  assert.deepEqual(where.source, { enabled: true });
});

test("buildVisibleEventWhere preserves city and free filters", () => {
  const where = buildVisibleEventWhere(
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-05-31T23:59:59.000Z"),
    { cities: ["tampa", "st_petersburg"], freeOnly: true },
  );
  assert.deepEqual(where.city, { in: ["tampa", "st_petersburg"] });
  assert.equal(where.isFree, true);
  assert.deepEqual(where.source, { enabled: true });
});
