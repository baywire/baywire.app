import { CalendarSearch } from "lucide-react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-(--radius-card) border border-dashed border-ink-200 bg-white/70 p-10 text-center dark:border-ink-700 dark:bg-ink-900/60">
      <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-gulf-50 text-gulf-500 dark:bg-gulf-700/40 dark:text-gulf-100">
        <CalendarSearch className="size-7" />
      </div>
      <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-sand-50">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-ink-500 dark:text-ink-300">
        {description}
      </p>
    </div>
  );
}
