import Link from "next/link";
import { Radio } from "lucide-react";

import { TextLink } from "@/components/ui";

interface SiteHeaderProps {
  showPlanLink?: boolean;
  showNavLinks?: boolean;
}

export function SiteHeader({ showPlanLink = true, showNavLinks = true }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/60 bg-sand-50/80 backdrop-blur-md dark:border-ink-700/60 dark:bg-ink-900/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-5">
        <Link
          href="/"
          className="group flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
          aria-label="Baywire — Tampa Bay events"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-sunset-400 to-gulf-400 text-white shadow-sm transition group-hover:rotate-6">
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
        {showNavLinks && (
          <nav className="hidden gap-6 text-sm sm:flex">
            {showPlanLink && (
              <TextLink href="/?view=plan" emphasize>
                My plan
              </TextLink>
            )}
            <TextLink href="/?window=tonight">Tonight</TextLink>
            <TextLink href="/?window=weekend">Weekend</TextLink>
            <TextLink href="/?window=week">All week</TextLink>
          </nav>
        )}
      </div>
    </header>
  );
}
