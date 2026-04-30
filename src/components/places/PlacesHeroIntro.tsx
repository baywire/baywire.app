interface PlacesHeroIntroProps {
  totalCount: number;
}

export function PlacesHeroIntro({ totalCount }: PlacesHeroIntroProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gulf-600 dark:text-gulf-200">
        AI-curated · Local favorites
      </p>
      <h1 className="font-display text-3xl font-semibold leading-[1.1] text-ink-900 sm:text-4xl md:text-5xl dark:text-sand-50">
        Discover the best spots in{" "}
        <span className="bg-linear-to-r from-sunset-500 to-gulf-500 bg-clip-text text-transparent">
          Tampa Bay
        </span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-ink-500 sm:text-base dark:text-ink-300">
        Restaurants, breweries, bars, parks, and hidden gems across Tampa, St. Pete,
        Clearwater, and beyond.
      </p>
      {totalCount > 0 && (
        <p className="mt-3 text-xs text-ink-400 dark:text-ink-400">
          {totalCount} curated places
        </p>
      )}
    </div>
  );
}
