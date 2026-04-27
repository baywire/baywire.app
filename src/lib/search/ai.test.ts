import test from "node:test";
import assert from "node:assert/strict";

import { SearchAIResultSchema } from "@/lib/search/ai";

test("SearchAIResultSchema accepts valid response payload", () => {
  const parsed = SearchAIResultSchema.parse({
    intentLine: "Looking for outdoor live music this weekend.",
    aiPickIDs: ["11111111-1111-4111-8111-111111111111"],
    reasons: [
      { id: "11111111-1111-4111-8111-111111111111", reason: "High match on live music and outdoor vibes." },
    ],
  });
  assert.equal(parsed.aiPickIDs.length, 1);
  assert.equal(parsed.reasons.length, 1);
});

test("SearchAIResultSchema accepts empty reasons array", () => {
  const parsed = SearchAIResultSchema.parse({
    intentLine: "test",
    aiPickIDs: ["11111111-1111-4111-8111-111111111111"],
  });
  assert.deepEqual(parsed.reasons, []);
});
