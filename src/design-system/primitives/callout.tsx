import { type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { type CalloutSize, calloutClasses } from "../variants";

export type CalloutProps = Omit<ComponentProps<"div">, "className"> & {
  size?: CalloutSize;
  className?: string;
  children: ReactNode;
};

export function Callout({ size = "default", className, ...props }: CalloutProps) {
  return <div className={cn(calloutClasses(size), className)} {...props} />;
}
