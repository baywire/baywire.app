"use client";

import { type ComponentProps, type ReactNode, forwardRef } from "react";

import { cn } from "@/lib/utils";

import { filterChipClasses } from "./variants";

export type FilterChipProps = Omit<ComponentProps<"button">, "className"> & {
  selected: boolean;
  tone: "gulf" | "ink";
  className?: string;
  children: ReactNode;
};

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  function FilterChip(
    { selected, tone, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(filterChipClasses({ selected, tone }), className)}
        {...props}
      />
    );
  },
);
