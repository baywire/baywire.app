import { ListOrdered, Radio } from "lucide-react";

import { HeroIntro } from "@/components/HeroIntro";

export default function Loading() {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <header className="sticky top-0 z-40 shrink-0 border-b border-ink-100/60 bg-sand-50/90 backdrop-blur-md dark:border-ink-700/60 dark:bg-ink-900/85">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <div className="group flex min-w-0 items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sunset-400 to-gulf-400 text-white shadow-sm">
              <Radio className="size-4" />
            </span>
            <span className="min-w-0 leading-none">
              <span className="inline">
                Bay
                <span className="text-gulf-500 dark:text-gulf-200">wire</span>
              </span>
              <span className="ml-1.5 hidden align-middle text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400 sm:ml-2 sm:inline dark:text-ink-300">
                Tampa Bay
              </span>
            </span>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-500 dark:text-ink-300">
            <ListOrdered className="size-4 shrink-0" aria-hidden />
            <span className="max-sm:sr-only">My plan</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col px-0 sm:px-0">
        <div className="w-full min-w-0 flex-1 px-4 pb-20 sm:px-5 md:pb-0">
          <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-6 pt-8 sm:-mx-5 sm:rounded-b-[2rem] sm:px-8 sm:pb-10 sm:pt-10">
            <HeroIntro />
            <div className="mx-auto mt-6 w-full max-w-5xl px-1 sm:px-0">
              <div className="motion-safe:animate-pulse h-11 w-full rounded-full bg-ink-100/60 dark:bg-ink-800/50" />
              <div className="motion-safe:animate-pulse mt-3 h-9 w-3/4 rounded-full bg-ink-100/50 dark:bg-ink-800/40" />
            </div>
          </section>

          <div className="mt-8 min-w-0 space-y-10">
            <div className="min-w-0">
              <div className="motion-safe:animate-pulse h-7 w-40 rounded-md bg-ink-100/60 dark:bg-ink-800/50" />
              <div className="motion-safe:animate-pulse mt-2 h-4 w-64 rounded-md bg-ink-100/40 dark:bg-ink-800/30" />
              <div className="motion-safe:animate-pulse mt-4 h-80 rounded-card border border-ink-100 bg-white/70 dark:border-ink-700 dark:bg-ink-900/60" />
            </div>

            <section className="min-w-0">
              <div className="motion-safe:animate-pulse h-7 w-32 rounded-md bg-ink-100/60 dark:bg-ink-800/50" />
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="motion-safe:animate-pulse h-72 rounded-card border border-ink-100 bg-white/70 dark:border-ink-700 dark:bg-ink-900/60"
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
