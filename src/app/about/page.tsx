import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "How We Curate",
  description:
    "How Baywire aggregates sources, deduplicates event records, and runs editorial AI curation before ranking featured picks.",
};

const STEPS = [
  {
    title: "Aggregate",
    body: "Baywire continuously ingests public event listings from local source sites and national ticketing feeds.",
  },
  {
    title: "Canonicalize",
    body: "Multiple listings for the same event are grouped into one canonical event so duplicates do not crowd the feed.",
  },
  {
    title: "Curate",
    body: "An editorial AI pass produces a concise summary, normalized tags, and a ranking score for each canonical event.",
  },
  {
    title: "Rank",
    body: "Standout picks prioritize fresh editorial scores, while stale or low-confidence records are de-prioritized.",
  },
] as const;

const LIMITS = [
  "Source sites can update, move, or remove event details after ingestion.",
  "Final attendance details (time, pricing, ticket policy) should always be verified on the source page.",
  "Not every event has enough signal for a high-confidence editorial score on first ingest.",
] as const;

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader showPlanLink={false} showNavLinks={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm dark:border-ink-700 dark:bg-ink-900/70 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gulf-600 dark:text-gulf-200">
            Baywire trust
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink-900 dark:text-sand-50">
            How we curate
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-200">
            Baywire is designed to surface what is actually worth doing across Tampa Bay, not to
            repeat every source listing verbatim.
          </p>

          <section className="mt-8 space-y-4">
            {STEPS.map((step, idx) => (
              <article
                key={step.title}
                className="rounded-xl border border-ink-100 bg-sand-50/70 p-4 dark:border-ink-700 dark:bg-ink-800/60"
              >
                <h2 className="font-display text-xl font-semibold text-ink-900 dark:text-sand-50">
                  {idx + 1}. {step.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-200">
                  {step.body}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold text-ink-900 dark:text-sand-50">
              Limits and verification
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600 dark:text-ink-200">
              {LIMITS.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </section>

          <p className="mt-8 text-sm text-ink-700 dark:text-sand-100">
            <Link
              href="/"
              className="text-gulf-700 underline decoration-dotted underline-offset-3 dark:text-gulf-200"
            >
              Back to events
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
