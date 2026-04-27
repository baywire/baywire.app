import test from "node:test";
import assert from "node:assert/strict";

import { hashEditorialInput } from "@/lib/pipeline/editorial";

test("hashEditorialInput is stable across input ordering", () => {
  const base = [
    {
      source: { slug: "eventbrite" },
      title: "Tampa Riverfest",
      description: "Waterfront music and food festival.",
    },
    {
      source: { slug: "visit_tampa_bay" },
      title: "Tampa Riverfest presented by Publix",
      description: "A weekend festival with concerts and food.",
    },
  ];
  const a = hashEditorialInput(base as never);
  const b = hashEditorialInput([base[1], base[0]] as never);
  assert.equal(a, b);
});
