"use client";

import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { externalCtaClasses } from "../variants";

export type ExternalPillLinkProps = Omit<ComponentProps<"a">, "className"> & {
  variant: "primary" | "outline";
  className?: string;
};

export function ExternalPillLink({
  variant,
  className,
  children,
  rel = "noreferrer",
  target = "_blank",
  ...props
}: ExternalPillLinkProps) {
  return (
    <a
      className={cn(externalCtaClasses({ variant }), className)}
      rel={rel}
      target={target}
      {...props}
    >
      {children}
    </a>
  );
}
