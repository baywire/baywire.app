"use client";

import { Button, FilterChip, Tag } from "@/design-system";

import { cn } from "@/lib/utils";

import type { TagOption } from "@/lib/events/tagOptions";

interface TopTagFilterProps {
  options: TagOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

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
    <div className="w-full text-left">
      <div className="mb-2 flex items-baseline justify-between gap-3">
      </div>
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
              <Tag
                size="xs"
                className={cn(
                  "ml-1.5 tabular-nums",
                  isOn
                    ? "text-ink-800 dark:text-white/90"
                    : "text-ink-500 dark:text-ink-400",
                )}
              >
                {count}
              </Tag>
            </FilterChip>
          );
        })}
        {selected.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-2 text-gulf-600 underline-offset-2 hover:underline dark:text-gulf-300"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export type { TopTagFilterProps };
