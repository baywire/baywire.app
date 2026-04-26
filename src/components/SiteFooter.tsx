export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-100/60 bg-sand-50/60 py-8 text-center text-xs text-ink-500 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-300">
      <div className="mx-auto max-w-6xl space-y-2 px-4 sm:px-6">
        <p>
          <span className="font-semibold text-ink-700 dark:text-sand-50">Baywire</span>{" "}
          — the live wire for Tampa Bay. Events aggregated and AI-summarized from
          Eventbrite, Visit Tampa Bay, Visit St. Pete/Clearwater, and the Tampa
          Bay Times.
        </p>
        <p>
          All event details belong to their original sources. Please verify time
          and ticketing on the source page before attending.
        </p>
        <p className="text-[11px] text-ink-400 dark:text-ink-400">
          © {new Date().getFullYear()} Baywire
        </p>
      </div>
    </footer>
  );
}
