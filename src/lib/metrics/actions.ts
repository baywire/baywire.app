"use server";

import { z } from "zod";

import { MetricAction, type Prisma } from "@/prisma/client";
import { prisma } from "@/lib/db/client";

const VALID_ACTIONS = new Set(Object.values(MetricAction));

const schema = z.object({
  sessionId: z.uuid(),
  action: z.string().refine((v) => VALID_ACTIONS.has(v as MetricAction), {
    message: "Invalid action",
  }),
  eventId: z.uuid().nullish(),
  placeId: z.uuid().nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
});

export async function recordMetric(input: z.input<typeof schema>): Promise<void> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;

  const { sessionId, action, eventId, placeId, payload } = parsed.data;

  await prisma.metric.create({
    data: {
      sessionId,
      action: action as MetricAction,
      eventId: eventId ?? undefined,
      placeId: placeId ?? undefined,
      payload: (payload as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
