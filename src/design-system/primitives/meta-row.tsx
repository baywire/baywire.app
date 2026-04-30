import { type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { metaRowClasses } from "../variants";

export type MetaRowProps = Omit<ComponentProps<"div">, "className"> & {
  className?: string;
  children: ReactNode;
};

export function MetaRow({ className, ...props }: MetaRowProps) {
  return <div className={cn(metaRowClasses(), className)} {...props} />;
}
