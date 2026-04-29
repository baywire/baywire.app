import { CalendarSearch, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actions,
  dashed = true,
  icon: Icon = CalendarSearch,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  dashed?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-card border border-ink-200 bg-white/70 p-10 text-center dark:border-ink-700 dark:bg-ink-900/60",
      dashed && "border-dashed",
    )}>
      <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-gulf-50 text-gulf-500 dark:bg-gulf-700/40 dark:text-gulf-100">
        <Icon className="size-7" />
      </div>
      <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-sand-50">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-ink-500 dark:text-ink-300">
        {description}
      </p>
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
