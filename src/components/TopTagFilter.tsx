"use client";

import { cn } from "@/lib/utils";

import type { TagOption } from "@/lib/events/tagOptions";

interface TopTagFilterProps {
  options: TagOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

/**
 * Multi-select of category tags. Selection is persisted by the parent (cookie).
 */
export function TopTagFilter({ options, selected, onChange }: TopTagFilterProps) {
  if (options.length === 0) return null;

  function toggle(tag: string) {
    const key = tag.toLowerCase();
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  function clearAll() {
    onChange(new Set());
  }

  return (
    <div className="w-full max-w-3xl text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-500 dark:text-ink-300">
          My top tags
        </p>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-gulf-600 underline-offset-2 hover:underline dark:text-gulf-300"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-500 dark:text-ink-300">
        Pick tags you care about; the list below only shows matching events. Your
        choices are saved in this browser.
      </p>
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        {options.map(({ tag, count }) => {
          const isOn = selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gulf-400",
                isOn
                  ? "border-gulf-500 bg-gulf-100 text-ink-900 dark:border-gulf-300 dark:bg-gulf-800/50 dark:text-sand-50"
                  : "border-ink-200/80 bg-white/60 text-ink-600 hover:border-ink-300 dark:border-ink-600 dark:bg-ink-900/50 dark:text-ink-200",
              )}
            >
              {tag}
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  isOn ? "text-ink-600 dark:text-ink-200" : "text-ink-400",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { TopTagFilterProps };
