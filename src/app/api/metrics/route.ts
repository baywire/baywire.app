import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { MetricAction } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

const VALID_ACTIONS = new Set(Object.values(MetricAction));

const bodySchema = z.object({
  sessionId: z.uuid(),
  action: z.string().refine((v) => VALID_ACTIONS.has(v as MetricAction), {
    message: "Invalid action",
  }),
  eventId: z.uuid().nullish(),
  placeId: z.uuid().nullish(),
  payload: z.record(z.unknown()).nullish(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { sessionId, action, eventId, placeId, payload } = parsed.data;

  await prisma.metric.create({
    data: {
      sessionId,
      action: action as MetricAction,
      eventId: eventId ?? undefined,
      placeId: placeId ?? undefined,
      payload: payload ?? undefined,
    },
  });

  return new NextResponse(null, { status: 204 });
}
