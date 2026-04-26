export function HeroIntro() {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gulf-600 dark:text-gulf-200">
        AI-curated · Updated every few hours
      </p>
      <h1 className="font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl md:text-6xl dark:text-sand-50">
        Find your next favorite night out in{" "}
        <span className="bg-gradient-to-r from-sunset-500 to-gulf-500 bg-clip-text text-transparent">
          Tampa Bay
        </span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-ink-500 sm:text-lg dark:text-ink-300">
        A live feed of music, food, art, family fun, and free things to do —
        gathered from across Tampa, St. Pete, Clearwater, Brandon, and
        Bradenton.
      </p>
    </div>
  );
}
