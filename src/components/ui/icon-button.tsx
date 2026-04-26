"use client";

import { type ComponentProps, type ReactNode, forwardRef } from "react";

import { cn } from "@/lib/utils";

import { iconButtonClasses } from "./variants";

export type IconButtonProps = Omit<ComponentProps<"button">, "className"> & {
  size?: "sm" | "md";
  /** `glass` = event card; `onDark` = dark header close; `plain` = unstyled + focus ring. */
  surface?: "glass" | "onDark" | "plain";
  className?: string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { size = "md", surface = "glass", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(iconButtonClasses({ size, surface }), className)}
        {...props}
      />
    );
  },
);
