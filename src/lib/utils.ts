import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Accepts strings, numbers, or Prisma `Decimal`-like values (anything with a
 * `toString()` that yields a numeric string). Returns a display label or null.
 */
export type PriceLike = string | number | { toString(): string } | null | undefined;

export function formatPrice(min: PriceLike, max: PriceLike, isFree: boolean): string | null {
  if (isFree) return "Free";
  const lo = toNumber(min);
  const hi = toNumber(max);
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && lo !== hi) return `$${lo.toFixed(0)} – $${hi.toFixed(0)}`;
  const value = lo ?? hi;
  if (value == null || Number.isNaN(value)) return null;
  return value === 0 ? "Free" : `$${value.toFixed(0)}`;
}

function toNumber(v: PriceLike): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isNaN(n) ? null : n;
}

export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}
