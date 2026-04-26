"use client";

import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { buttonClasses } from "./variants";

export type ButtonProps = Omit<ComponentProps<"button">, "className"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size }), className)}
      {...props}
    />
  );
}
