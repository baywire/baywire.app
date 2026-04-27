export function HeroIntro() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gulf-600 dark:text-gulf-200">
        AI-curated · Updated every day
      </p>
      <h1 className="font-display text-3xl font-semibold leading-[1.1] text-ink-900 sm:text-4xl md:text-5xl dark:text-sand-50">
        Find your next favorite night out in{" "}
        <span className="bg-linear-to-r from-sunset-500 to-gulf-500 bg-clip-text text-transparent">
          Tampa Bay
        </span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-ink-500 sm:text-base dark:text-ink-300">
        Live music, food, art, and free things to do across Tampa, St. Pete,
        Clearwater, Brandon, and Bradenton.
      </p>
    </div>
  );
}
