import { cn } from "@/lib/utils";

/** Default focus ring for controls on light surfaces (cards, modals, filters). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gulf-400";

/** Focus ring for controls on the dark dialog header. */
export const focusRingOnDark =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-200";

export const navLinkClass =
  "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50";

export const navLinkEmphasisClass =
  "font-medium text-gulf-600 hover:text-ink-900 dark:text-gulf-200 dark:hover:text-sand-50";

type ButtonOptions = {
  variant: "primary" | "secondary" | "ghost";
  size: "sm" | "md";
  className?: string;
};

export function buttonClasses({ variant, size, className }: ButtonOptions): string {
  const sizeClasses =
    size === "sm" ? "px-3 py-1.5 text-xs sm:text-sm" : "px-5 py-2.5 text-sm font-medium";

  if (variant === "primary") {
    return cn(
      "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition",
      focusRing,
      "bg-ink-900 text-sand-50 hover:bg-ink-700 dark:bg-sand-50 dark:text-ink-900",
      className,
    );
  }
  if (variant === "secondary") {
    return cn(
      "inline-flex items-center justify-center rounded-full border font-medium transition",
      focusRing,
      "border border-ink-200 bg-white text-ink-800 shadow-sm hover:border-ink-300",
      "dark:border-ink-600 dark:bg-ink-900/80 dark:text-sand-100",
      sizeClasses,
      className,
    );
  }
  return cn(
    "inline-flex items-center justify-center rounded-full font-medium transition",
    focusRing,
    sizeClasses,
    "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50",
    className,
  );
}

type FilterChipOptions = {
  selected: boolean;
  tone: "gulf" | "ink";
  className?: string;
};

export function filterChipClasses({ selected, tone, className }: FilterChipOptions): string {
  if (tone === "gulf") {
    return cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition",
      focusRing,
      selected
        ? "border-gulf-500 bg-gulf-100 text-ink-900 dark:border-gulf-300 dark:bg-gulf-700 dark:text-white"
        : "border-ink-200/80 bg-white/60 text-ink-600 hover:border-ink-300 dark:border-ink-600 dark:bg-ink-900/50 dark:text-ink-200",
      className,
    );
  }

  return cn(
    "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
    focusRing,
    selected
      ? "border-ink-900 bg-ink-900 text-sand-50 shadow-sm dark:border-sand-50 dark:bg-sand-50 dark:text-ink-900"
      : "border-ink-200 bg-white/70 text-ink-700 backdrop-blur hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900/60 dark:text-sand-100",
    className,
  );
}

type IconButtonOptions = {
  size: "sm" | "md";
  /** Default = frosted control on event cards. */
  surface: "glass" | "onDark" | "plain";
  className?: string;
};

export function iconButtonClasses({ size, surface, className }: IconButtonOptions): string {
  const sizeCls = size === "sm" ? "size-8" : "size-9";
  if (surface === "onDark") {
    return cn(
      "flex shrink-0 items-center justify-center rounded-full text-sand-200",
      "transition hover:bg-white/10 hover:text-sand-50",
      focusRingOnDark,
      sizeCls,
      className,
    );
  }
  if (surface === "plain") {
    return cn(
      "flex items-center justify-center transition",
      focusRing,
      sizeCls,
      className,
    );
  }
  return cn(
    /** z-20: below app header (z-40); above card hit target (z-10). Opaque + shadow so light/gradient backdrops can’t wash through. */
    "relative z-20 flex items-center justify-center rounded-full",
    "bg-ink-900 text-sand-100",
    "shadow-[0_2px_12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]",
    "transition hover:scale-105 hover:bg-ink-800",
    "dark:bg-ink-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)]",
    focusRing,
    sizeCls,
    className,
  );
}

export const segmentedListClass =
  "inline-flex items-center rounded-full border border-ink-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-ink-700 dark:bg-ink-900/60";

type SegmentedTabOptions = { active: boolean; pending?: boolean; className?: string };

export function segmentedTabClasses({
  active,
  pending = false,
  className,
}: SegmentedTabOptions): string {
  return cn(
    "rounded-full px-4 py-1.5 text-sm font-medium transition",
    focusRing,
    active
      ? "bg-ink-900 text-sand-50 dark:bg-sand-50 dark:text-ink-900"
      : "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50",
    pending && !active && "opacity-60",
    className,
  );
}

type ExternalCtaOptions = { variant: "primary" | "outline"; className?: string };

export function externalCtaClasses({ variant, className }: ExternalCtaOptions): string {
  return cn(
    "inline-flex items-center gap-2 rounded-full text-sm font-semibold transition",
    focusRing,
    variant === "primary"
      ? "bg-ink-900 px-5 py-2.5 text-sand-50 hover:bg-ink-700 dark:bg-sand-50 dark:text-ink-900 dark:hover:bg-sand-200"
      : "border border-ink-200 px-5 py-2.5 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-sand-100 dark:hover:border-ink-500",
    className,
  );
}

/** Compact in-app (Next) link, e.g. event dialog “Page” chip. */
export const inAppPillLinkClass = cn(
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-sand-200/90 bg-sand-50",
  "px-2.5 text-xs font-semibold text-gulf-700 shadow-sm transition",
  "hover:border-sand-100 hover:bg-white sm:px-3 sm:text-sm",
  focusRing,
);
