import { type ComponentProps, type ElementType } from "react";

import { cn } from "@/lib/utils";

import { type EyebrowTone, eyebrowClasses } from "../variants";

export type EyebrowProps = Omit<ComponentProps<"p">, "className"> & {
  tone?: EyebrowTone;
  as?: ElementType;
  className?: string;
};

export function Eyebrow({ tone = "gulf", as, className, ...props }: EyebrowProps) {
  const Element = as ?? "p";
  return <Element className={cn(eyebrowClasses(tone), className)} {...props} />;
}
