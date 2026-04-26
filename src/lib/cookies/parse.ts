import { z } from "zod";

const tagsSchema = z.array(z.string().min(1).max(64)).max(32);
const idsSchema = z.array(z.uuid()).max(80);
const planOrderSchema = z.array(z.uuid()).max(80);

export function parseTopTagsCookie(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const json = JSON.parse(value) as unknown;
    const r = tagsSchema.safeParse(json);
    return r.success ? r.data : [];
  } catch {
    return [];
  }
}

export function parseSavedEventIdsCookie(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const json = JSON.parse(value) as unknown;
    const r = idsSchema.safeParse(json);
    return r.success ? r.data : [];
  } catch {
    return [];
  }
}

/** Ordered itinerary (first = earliest in user's mental model, but reordered in UI as needed). */
export function parsePlanOrderCookie(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const json = JSON.parse(value) as unknown;
    const r = planOrderSchema.safeParse(json);
    return r.success ? r.data : [];
  } catch {
    return [];
  }
}
