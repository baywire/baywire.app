import { NextResponse, type NextRequest } from "next/server";

import { isCityKey } from "@/lib/cities";
import { listEvents } from "@/lib/db/queries";
import type { WindowKey } from "@/lib/time/window";

export const runtime = "nodejs";

const VALID_WINDOWS = new Set<WindowKey>(["tonight", "weekend", "week"]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const windowRaw = (sp.get("window") ?? "weekend") as WindowKey;
  const window: WindowKey = VALID_WINDOWS.has(windowRaw) ? windowRaw : "weekend";

  const cities = (sp.getAll("city").length > 0 ? sp.getAll("city") : (sp.get("city") ?? "")
    .split(",")
    .filter(Boolean))
    .filter(isCityKey);

  const freeOnly = sp.get("free") === "true";
  const limitParam = Number(sp.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 100;

  const rows = await listEvents({
    window,
    cities: cities.length ? cities : undefined,
    freeOnly,
    limit,
  });

  return NextResponse.json({ window, count: rows.length, events: rows });
}
