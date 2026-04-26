"use client";

import { FilterChip } from "@/components/ui";

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
            <FilterChip
              key={tag}
              type="button"
              tone="gulf"
              selected={isOn}
              onClick={() => toggle(tag)}
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
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
}

export type { TopTagFilterProps };
