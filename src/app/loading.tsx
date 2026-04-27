import { ListOrdered, Radio, Search } from "lucide-react";

import { HeroIntro } from "@/components/HeroIntro";

export default function Loading() {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <header className="sticky top-0 z-40 shrink-0 border-b border-ink-100/60 bg-sand-50/90 backdrop-blur-md dark:border-ink-700/60 dark:bg-ink-900/85">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-5">
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
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-500 dark:text-ink-300">
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="max-sm:sr-only">Search</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-500 dark:text-ink-300">
              <ListOrdered className="size-4 shrink-0" aria-hidden />
              <span className="max-sm:sr-only">My plan</span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col px-0 sm:px-0">
        <div className="w-full min-w-0 max-w-7xl flex-1 px-4 pb-20 sm:px-5 md:pb-0">
          <section className="gradient-hero -mx-4 rounded-b-3xl px-4 pb-6 pt-8 sm:-mx-5 sm:rounded-b-4xl sm:px-8 sm:pb-10 sm:pt-10">
            <HeroIntro />
            <div className="mx-auto mt-6 w-full max-w-5xl px-1 sm:px-0">
              <div className="skeleton h-11 w-full rounded-full" />
              <div className="skeleton mt-3 h-9 w-3/4 rounded-full" />
            </div>
          </section>

          <div className="mx-auto mt-6 w-full">
            <div className="skeleton h-9 w-full max-w-3xl rounded-full" />
          </div>

          <div className="mt-8 min-w-0 space-y-10">
            <div className="min-w-0">
              <div className="skeleton h-7 w-40 rounded-md" />
              <div className="skeleton mt-2 h-4 w-64 rounded-md" />
              <div className="skeleton mt-4 h-80 rounded-card" />
            </div>

            <section className="min-w-0">
              <div className="skeleton h-7 w-32 rounded-md" />
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-72 rounded-card" />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
