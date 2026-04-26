import Link from "next/link";
import { Radio } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-100/60 bg-sand-50/80 backdrop-blur-md dark:border-ink-700/60 dark:bg-ink-900/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
          aria-label="Baywire — Tampa Bay events"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-sunset-400 to-gulf-400 text-white shadow-sm transition group-hover:rotate-6">
            <Radio className="size-4" />
          </span>
          <span className="leading-none">
            Bay
            <span className="text-gulf-500 dark:text-gulf-200">wire</span>
            <span className="ml-2 hidden align-middle text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400 sm:inline dark:text-ink-300">
              Tampa Bay
            </span>
          </span>
        </Link>
        <nav className="hidden gap-6 text-sm text-ink-500 sm:flex dark:text-ink-300">
          <a href="#tonight" className="hover:text-ink-900 dark:hover:text-sand-50">
            Tonight
          </a>
          <a href="#weekend" className="hover:text-ink-900 dark:hover:text-sand-50">
            Weekend
          </a>
          <a href="#week" className="hover:text-ink-900 dark:hover:text-sand-50">
            All Week
          </a>
        </nav>
      </div>
    </header>
  );
}
