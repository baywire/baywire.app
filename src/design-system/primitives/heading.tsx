import { type ComponentProps, type ElementType } from "react";

import { cn } from "@/lib/utils";

import { type HeadingLevel, headingClasses } from "../variants";

const defaultElementMap: Record<HeadingLevel, ElementType> = {
  display: "h1",
  page: "h1",
  section: "h2",
  subsection: "h2",
};

export type HeadingProps = Omit<ComponentProps<"h1">, "className"> & {
  level: HeadingLevel;
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
};

export function Heading({ level, as, className, ...props }: HeadingProps) {
  const Element = as ?? defaultElementMap[level];
  return <Element className={cn(headingClasses(level), className)} {...props} />;
}
