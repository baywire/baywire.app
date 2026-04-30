import type { Metadata } from "next";

import { Eyebrow, Heading, Text, TextLink } from "@/design-system";
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
          <Eyebrow className="tracking-[0.16em]">Baywire trust</Eyebrow>
          <Heading level="page" className="mt-2">How we curate</Heading>
          <Text className="mt-3 max-w-2xl">
            Baywire is designed to surface what is actually worth doing across Tampa Bay, not to
            repeat every source listing verbatim.
          </Text>

          <section className="mt-8 space-y-4">
            {STEPS.map((step, idx) => (
              <article
                key={step.title}
                className="rounded-xl border border-ink-100 bg-sand-50/70 p-4 dark:border-ink-700 dark:bg-ink-800/60"
              >
                <Heading level="subsection">
                  {idx + 1}. {step.title}
                </Heading>
                <Text className="mt-1">{step.body}</Text>
              </article>
            ))}
          </section>

          <section className="mt-8">
            <Heading level="subsection">Limits and verification</Heading>
            <Text as="ul" className="mt-3 space-y-2">
              {LIMITS.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </Text>
          </section>

          <p className="mt-8 text-sm">
            <TextLink
              href="/"
              emphasize
              className="underline decoration-dotted underline-offset-3"
            >
              Back to events
            </TextLink>
          </p>
        </div>
      </main>
    </div>
  );
}
