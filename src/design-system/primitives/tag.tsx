import { type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { tagClasses } from "../variants";

export type TagProps = Omit<ComponentProps<"span">, "className"> & {
  size?: "xs" | "sm";
  className?: string;
  children: ReactNode;
};

export function Tag({ size = "sm", className, ...props }: TagProps) {
  return <span className={cn(tagClasses({ size }), className)} {...props} />;
}
