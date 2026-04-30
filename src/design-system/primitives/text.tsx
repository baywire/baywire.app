import { type ComponentProps, type ElementType } from "react";

import { cn } from "@/lib/utils";

import { type TextVariant, textClasses } from "../variants";

export type TextProps = Omit<ComponentProps<"p">, "className"> & {
  variant?: TextVariant;
  as?: ElementType;
  className?: string;
};

export function Text({ variant = "default", as, className, ...props }: TextProps) {
  const Element = as ?? "p";
  return <Element className={cn(textClasses(variant), className)} {...props} />;
}
