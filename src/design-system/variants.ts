import { cn } from "@/lib/utils";

import { focusRing, focusRingOnDark } from "./tokens";

export { focusRing, focusRingOnDark } from "./tokens";

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

export type HeadingLevel = "display" | "page" | "section" | "subsection";

const headingLevelMap: Record<HeadingLevel, string> = {
  display: "font-display text-3xl font-semibold leading-[1.1] sm:text-4xl md:text-5xl",
  page: "font-display text-3xl font-semibold",
  section: "font-display text-2xl font-semibold",
  subsection: "font-display text-xl font-semibold",
};

export function headingClasses(level: HeadingLevel, className?: string): string {
  return cn(headingLevelMap[level], "text-ink-900 dark:text-sand-50", className);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export type TextVariant = "default" | "muted" | "prose" | "meta";

const textVariantMap: Record<TextVariant, string> = {
  default: "text-sm leading-relaxed text-ink-600 dark:text-ink-200",
  muted: "text-sm text-ink-500 dark:text-ink-300",
  prose: "whitespace-pre-line text-base leading-relaxed text-ink-700 dark:text-sand-100",
  meta: "text-xs text-ink-500 dark:text-ink-300",
};

export function textClasses(variant: TextVariant, className?: string): string {
  return cn(textVariantMap[variant], className);
}

// ---------------------------------------------------------------------------
// Eyebrow
// ---------------------------------------------------------------------------

export type EyebrowTone = "gulf" | "ink";

const eyebrowToneMap: Record<EyebrowTone, string> = {
  gulf: "text-gulf-600 dark:text-gulf-200",
  ink: "text-ink-500 dark:text-ink-300",
};

export function eyebrowClasses(tone: EyebrowTone, className?: string): string {
  return cn("text-xs font-semibold uppercase tracking-wide", eyebrowToneMap[tone], className);
}

// ---------------------------------------------------------------------------
// MetaRow (chip/tag container)
// ---------------------------------------------------------------------------

export function metaRowClasses(className?: string): string {
  return cn(
    "flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide",
    "text-gulf-600 dark:text-gulf-200",
    className,
  );
}

// ---------------------------------------------------------------------------
// CardTitle
// ---------------------------------------------------------------------------

export function cardTitleClasses(interactive: boolean, className?: string): string {
  return cn(
    "min-w-0 wrap-break-word font-display text-lg font-semibold leading-snug text-ink-900 dark:text-sand-50",
    interactive && "group-hover:text-gulf-600 dark:group-hover:text-gulf-200",
    className,
  );
}

// ---------------------------------------------------------------------------
// Callout ("Why this pick")
// ---------------------------------------------------------------------------

export type CalloutSize = "compact" | "default";

export function calloutClasses(size: CalloutSize, className?: string): string {
  return cn(
    "rounded-card border border-ink-200 bg-white/80 text-sm text-ink-700",
    "dark:border-ink-600 dark:bg-ink-900/70 dark:text-sand-100",
    size === "compact" ? "px-3 py-2" : "px-4 py-3",
    className,
  );
}

// ---------------------------------------------------------------------------
// StickyDayHeading
// ---------------------------------------------------------------------------

export function stickyDayHeadingClasses(className?: string): string {
  return cn(
    "sticky top-14 z-30 -mx-4 bg-sand-50/85 px-4 py-2 backdrop-blur",
    "font-display text-xl font-semibold text-ink-900",
    "sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:text-2xl",
    "dark:bg-ink-900/80 dark:text-sand-50",
    className,
  );
}

// ---------------------------------------------------------------------------
// Card shell (interactive card wrapper)
// ---------------------------------------------------------------------------

export function cardShellClasses(className?: string): string {
  return cn(
    "group relative flex min-w-0 max-w-full flex-col overflow-hidden rounded-card border",
    "border-ink-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
    "dark:border-ink-700 dark:bg-ink-900/80",
    className,
  );
}

// ---------------------------------------------------------------------------
// Detail sheet (bordered panel in detail views)
// ---------------------------------------------------------------------------

export function detailSheetClasses(className?: string): string {
  return cn("rounded-card border border-ink-100 shadow-sm dark:border-ink-700", className);
}

// ---------------------------------------------------------------------------
// Modal scrim + panel
// ---------------------------------------------------------------------------

export function modalScrimClasses(className?: string): string {
  return cn("absolute inset-0 bg-ink-900/50 backdrop-blur-[2px] dark:bg-black/60", className);
}

export function modalPanelClasses(className?: string): string {
  return cn(
    "bg-sand-50 shadow-2xl sm:max-h-[min(100dvh,56rem)] sm:max-w-xl sm:rounded-2xl",
    "dark:bg-ink-900",
    className,
  );
}

// ---------------------------------------------------------------------------
// Nav links
// ---------------------------------------------------------------------------

export const navLinkClass =
  "text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-sand-50";

export const navLinkEmphasisClass =
  "font-medium text-gulf-600 hover:text-ink-900 dark:text-gulf-200 dark:hover:text-sand-50";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Chip (display, non-interactive)
// ---------------------------------------------------------------------------

const chipToneMap: Record<string, string> = {
  gulf: "bg-gulf-50 text-gulf-600 dark:bg-gulf-700/40 dark:text-gulf-200",
  sunset: "bg-sunset-200 text-sunset-600 dark:bg-sunset-500/20 dark:text-sunset-300",
  sand: "bg-sand-100 text-sand-700 dark:bg-sand-700/30 dark:text-sand-100",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-200",
  red: "bg-red-50 text-red-700 dark:bg-red-700/30 dark:text-red-200",
  ink: "bg-ink-100 text-ink-600 dark:bg-ink-700/60 dark:text-ink-200",
};

type ChipOptions = {
  tone: "gulf" | "sunset" | "sand" | "emerald" | "red" | "ink";
  className?: string;
};

export function chipClasses({ tone, className }: ChipOptions): string {
  return cn(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
    chipToneMap[tone],
    className,
  );
}

// ---------------------------------------------------------------------------
// FilterChip (interactive toggle)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tag (small taxonomy label)
// ---------------------------------------------------------------------------

type TagOptions = {
  size: "xs" | "sm";
  className?: string;
};

export function tagClasses({ size, className }: TagOptions): string {
  return cn(
    "rounded-full bg-ink-50 dark:bg-ink-700/60",
    size === "xs"
      ? "px-1.5 py-0.5 text-[11px] font-medium"
      : "px-2 py-0.5 text-xs capitalize",
    className,
  );
}

// ---------------------------------------------------------------------------
// IconButton
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// External CTA
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// In-app pill link
// ---------------------------------------------------------------------------

/** Compact in-app (Next) link, e.g. event dialog "Page" chip. */
export const inAppPillLinkClass = cn(
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-sand-200/90 bg-sand-50",
  "px-3.5 text-sm font-semibold text-gulf-700 shadow-sm transition",
  "hover:border-sand-100 hover:bg-white sm:h-9 sm:px-3",
  focusRing,
);

// ---------------------------------------------------------------------------
// Card affordance (hover arrow circle)
// ---------------------------------------------------------------------------

export const cardAffordanceClass = cn(
  "pointer-events-none absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full",
  "bg-ink-900 text-sand-100 opacity-0 transition group-hover:opacity-100",
  "shadow-[0_2px_12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]",
);
