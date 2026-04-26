import { SiteHeader } from "@/components/SiteHeader";

export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:px-6">
        <div className="gradient-hero -mx-4 h-72 rounded-b-3xl sm:-mx-6 sm:rounded-b-[2rem]" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-(--radius-card) border border-ink-100 bg-white/70 dark:border-ink-700 dark:bg-ink-900/60"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
