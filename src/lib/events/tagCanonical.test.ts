import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCategoryTags } from "@/lib/events/tagCanonical";

test("normalizeCategoryTags applies slash, ampersand and alias cleanup", () => {
  const tags = normalizeCategoryTags(
    ["Markets/Shopping", "Arts & Theatre", "Live Show", "Kids", "markets"],
    6,
  );
  assert.deepEqual(tags, ["market", "art", "theater", "music", "family"]);
});
