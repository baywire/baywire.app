import { Eyebrow, Heading, Text } from "@/design-system";

interface HeroIntroProps {
  curation?: {
    visibleCount: number;
    curatedCount: number;
    coveragePct: number;
    refreshedAt: Date | null;
  };
}

function formatRelativeHours(from: Date): string {
  const diffMs = Date.now() - from.getTime();
  const hours = Math.max(0, Math.floor(diffMs / (60 * 60 * 1000)));
  if (hours < 1) return "just now";
  if (hours === 1) return "1h ago";
  return `${hours}h ago`;
}

export function HeroIntro({ curation }: HeroIntroProps) {
  const trustLine =
    curation && curation.visibleCount > 0
      ? `Curated from ${curation.curatedCount}/${curation.visibleCount} visible events (${curation.coveragePct}%)${curation.refreshedAt ? ` · refreshed ${formatRelativeHours(curation.refreshedAt)}` : ""}`
      : null;

  return (
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow className="mb-2">
        AI-curated · Updated every day
      </Eyebrow>
      <Heading level="display">
        Find your next favorite night out in{" "}
        <span className="bg-linear-to-r from-sunset-500 to-gulf-500 bg-clip-text text-transparent">
          Tampa Bay
        </span>
      </Heading>
      <Text variant="muted" className="mx-auto mt-3 max-w-xl text-balance sm:text-base">
        Live music, food, art, and free things to do across Tampa, St. Pete,
        Clearwater, Brandon, and Bradenton.
      </Text>
      {trustLine && (
        <p className="mx-auto mt-3 hidden max-w-fit items-center rounded-full border border-gulf-200/80 bg-white/80 px-3 py-1 text-xs text-ink-600 shadow-sm dark:border-gulf-700/70 dark:bg-ink-900/70 dark:text-ink-200">
          {trustLine}
        </p>
      )}
    </div>
  );
}
