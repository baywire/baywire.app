"use client";

import { type ComponentProps, type ReactNode, forwardRef } from "react";

import { cn } from "@/lib/utils";

import { chipClasses, filterChipClasses } from "../variants";

// ---------------------------------------------------------------------------
// Chip — non-interactive display pill (renders <span>)
// ---------------------------------------------------------------------------

export type ChipProps = Omit<ComponentProps<"span">, "className"> & {
  tone: "gulf" | "sunset" | "sand" | "emerald" | "red" | "ink";
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Chip({ tone, icon, className, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipClasses({ tone }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// FilterChip — interactive toggle (renders <button>)
// ---------------------------------------------------------------------------

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
