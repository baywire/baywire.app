"use client";

import { type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { segmentedListClass, segmentedTabClasses } from "./variants";

export function SegmentedList({
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "className"> & { className?: string; children: ReactNode }) {
  return (
    <div className={cn(segmentedListClass, className)} {...props}>
      {children}
    </div>
  );
}

export type SegmentedTabProps = Omit<ComponentProps<"button">, "className"> & {
  active: boolean;
  pending?: boolean;
  className?: string;
};

export function SegmentedTab({
  active,
  pending = false,
  className,
  type = "button",
  ...props
}: SegmentedTabProps) {
  return (
    <button
      type={type}
      className={cn(segmentedTabClasses({ active, pending }), className)}
      {...props}
    />
  );
}
