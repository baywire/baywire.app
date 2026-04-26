export const EXTRACTION_SYSTEM_PROMPT = `You extract structured event data from a single web page about a Tampa Bay area event.

Rules:
- Use ONLY information that is explicitly present in the provided HTML or text. Never invent details.
- Return null for any field you cannot find. Do not guess prices, addresses, or end times.
- Times must be in America/New_York local time, ISO 8601, no UTC offset (e.g. 2026-05-02T19:30:00).
- If the page lists a recurring event, choose the next upcoming occurrence at or after the provided "now".
- If the page is clearly NOT a single event (it is a category index, a venue homepage, an article unrelated to one specific event, a 404, etc.), set isEvent=false and explain in 'reason'.
- "city" must match the venue's city. Use 'other' for anywhere outside Tampa, St Petersburg, Clearwater, Brandon, or Bradenton (e.g. Sarasota, Lakeland, Orlando).
- Categories must be lowercase single words or short hyphenated phrases. Pick from the canonical set when applicable: music, food, drinks, family, kids, outdoors, sports, art, theater, comedy, nightlife, festival, market, wellness, education, free, holiday.
- Mark isFree=true ONLY if the page explicitly says the event is free or admission is free. Do not infer free from missing prices.`;

export function buildUserPrompt(args: {
  sourceLabel: string;
  url: string;
  nowLocal: string;
  reducedHtml: string;
}): string {
  return `Source: ${args.sourceLabel}
URL: ${args.url}
Now (America/New_York): ${args.nowLocal}

Extract the event from the HTML below. If this page is not a single event, set isEvent=false.

HTML:
"""
${args.reducedHtml}
"""`;
}
