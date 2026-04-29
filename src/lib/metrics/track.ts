"use client";

import type { MetricAction } from "@/generated/prisma/client";
import { getOrCreateSessionId } from "@/lib/cookies/browser";

interface TrackOptions {
  action: MetricAction;
  eventId?: string;
  placeId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Fire-and-forget metric recording. Sends a beacon to `/api/metrics`.
 * Falls back to `fetch` when `sendBeacon` is unavailable.
 */
export function trackMetric(opts: TrackOptions): void {
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;

  const body = JSON.stringify({
    sessionId,
    action: opts.action,
    eventId: opts.eventId ?? null,
    placeId: opts.placeId ?? null,
    payload: opts.payload ?? null,
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/metrics",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  fetch("/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
