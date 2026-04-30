"use client";

import type { MetricAction } from "@/prisma/client";
import { getOrCreateSessionId } from "@/lib/cookies/browser";
import { recordMetric } from "@/lib/metrics/actions";

interface TrackOptions {
  action: MetricAction;
  eventId?: string;
  placeId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Fire-and-forget metric recording via Server Action.
 * Silently swallows errors — metrics should never break the UI.
 */
export function trackMetric(opts: TrackOptions): void {
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;

  recordMetric({
    sessionId,
    action: opts.action,
    eventId: opts.eventId ?? null,
    placeId: opts.placeId ?? null,
    payload: opts.payload ?? null,
  }).catch(() => { });
}
