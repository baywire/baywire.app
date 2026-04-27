import assert from "node:assert/strict";
import test from "node:test";

import { filterEnabledAdapters } from "@/lib/sources/enabled";

interface AdapterStub {
  slug: string;
  label: string;
  baseUrl: string;
}

const ADAPTERS: AdapterStub[] = [
  { slug: "eventbrite", label: "Eventbrite", baseUrl: "https://www.eventbrite.com" },
  { slug: "visit_tampa_bay", label: "Visit Tampa Bay", baseUrl: "https://www.visittampabay.com" },
];

test("filterEnabledAdapters excludes explicitly disabled adapters", () => {
  const filtered = filterEnabledAdapters(ADAPTERS, [
    { slug: "eventbrite", enabled: false },
    { slug: "visit_tampa_bay", enabled: true },
  ]);
  assert.deepEqual(filtered.map((item) => item.slug), ["visit_tampa_bay"]);
});

test("filterEnabledAdapters keeps adapters without source rows", () => {
  const filtered = filterEnabledAdapters(ADAPTERS, [
    { slug: "eventbrite", enabled: true },
  ]);
  assert.deepEqual(filtered.map((item) => item.slug), ["eventbrite", "visit_tampa_bay"]);
});
