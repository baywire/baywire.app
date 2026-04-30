import pLimit from "p-limit";

import { loadHtml } from "@/lib/scrapers/parse";

/**
 * For each place missing an imageUrl, attempt to fetch og:image / twitter:image
 * from the place's website. This is far more reliable than asking an LLM to
 * extract image URLs from web search results.
 */
export async function resolveImages<T extends { imageUrl: string | null; websiteUrl: string | null }>(
  places: T[],
  opts: { concurrency?: number } = {},
): Promise<T[]> {
  const limit = pLimit(opts.concurrency ?? 10);

  const tasks = places.map((p) => {
    if (p.imageUrl || !p.websiteUrl) return Promise.resolve(p);
    return limit(() => resolveOgImage(p));
  });

  return Promise.all(tasks);
}

async function resolveOgImage<T extends { imageUrl: string | null; websiteUrl: string | null }>(
  place: T,
): Promise<T> {
  if (!place.websiteUrl) return place;

  try {
    const res = await fetch(place.websiteUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return place;

    const html = await res.text();
    const imageUrl = extractMetaImage(html, place.websiteUrl);
    if (imageUrl) return { ...place, imageUrl };
  } catch {
    // Best-effort — don't fail the pipeline over an image
  }
  return place;
}

function extractMetaImage(html: string, baseUrl: string): string | null {
  const $ = loadHtml(html);

  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const url = absolutize(raw.trim(), baseUrl);
    if (url && isValidImageUrl(url)) return url;
  }

  return null;
}

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.pathname.length < 2) return false;
    return true;
  } catch {
    return false;
  }
}
