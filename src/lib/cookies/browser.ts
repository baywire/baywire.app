"use client";

import {
  COOKIE_PLAN,
  COOKIE_SAVED_EVENTS,
  COOKIE_TOP_TAGS,
  MAX_AGE_PLAN_SEC,
  MAX_AGE_SAVED_EVENTS_SEC,
  MAX_AGE_TOP_TAGS_SEC,
} from "./constants";
import { parsePlanOrderCookie } from "./parse";

/**
 * Sets a first-party cookie (non-HttpOnly) for client-side preferences.
 */
export function setJsonCookie(
  name: string,
  value: unknown,
  maxAgeSec: number,
): void {
  if (typeof document === "undefined") return;
  const body = JSON.stringify(value);
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(body)}`,
    "path=/",
    `max-age=${maxAgeSec}`,
    "samesite=lax",
    secure ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function setTopTagsCookie(tags: string[]): void {
  setJsonCookie(COOKIE_TOP_TAGS, tags, MAX_AGE_TOP_TAGS_SEC);
}

export function setSavedEventIdsCookie(ids: string[]): void {
  setJsonCookie(COOKIE_SAVED_EVENTS, ids, MAX_AGE_SAVED_EVENTS_SEC);
}

export function setPlanOrderCookie(orderedIds: string[]): void {
  setJsonCookie(COOKIE_PLAN, orderedIds, MAX_AGE_PLAN_SEC);
}

export function getPlanOrderFromBrowser(): string[] {
  if (typeof document === "undefined") return [];
  const parts = document.cookie.split(";").map((p) => p.trim());
  const raw = parts.find((p) =>
    p.startsWith(`${encodeURIComponent(COOKIE_PLAN)}=`),
  );
  if (!raw) return [];
  const value = raw.slice(encodeURIComponent(COOKIE_PLAN).length + 1);
  try {
    return parsePlanOrderCookie(decodeURIComponent(value));
  } catch {
    return [];
  }
}
