import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { stickyDayHeadingClasses } from "../variants";

export type StickyDayHeadingProps = Omit<ComponentProps<"h2">, "className"> & {
  className?: string;
};

export function StickyDayHeading({ className, ...props }: StickyDayHeadingProps) {
  return <h2 className={cn(stickyDayHeadingClasses(), className)} {...props} />;
}
