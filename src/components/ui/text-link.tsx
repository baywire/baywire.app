"use client";

import Link from "next/link";
import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { inAppPillLinkClass, navLinkClass, navLinkEmphasisClass } from "./variants";

export type TextLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  /** Uses gulf accent (e.g. “My plan” in the site header). */
  emphasize?: boolean;
  className?: string;
};

export function TextLink({ emphasize, className, ...props }: TextLinkProps) {
  return (
    <Link
      className={cn(emphasize ? navLinkEmphasisClass : navLinkClass, className)}
      {...props}
    />
  );
}

export type PillLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string;
};

/** In-app navigation that looks like a compact pill (e.g. event dialog “Page”). */
export function PillLink({ className, ...props }: PillLinkProps) {
  return <Link className={cn(inAppPillLinkClass, className)} {...props} />;
}
