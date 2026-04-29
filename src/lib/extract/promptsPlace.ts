export const PLACE_EXTRACTION_SYSTEM_PROMPT = `You extract structured place data from a web page about a Tampa Bay area restaurant, bar, brewery, cafe, museum, park, or other local business.

Rules:
- Use ONLY information that is explicitly present in the provided HTML or text. Never invent details.
- Return null for any field you cannot find. Do not guess addresses, phone numbers, or hours.
- If the page is clearly NOT about a specific place (it is a list index, a blog post not about one place, a 404, etc.), set isPlace=false and explain in 'reason'.
- "city" must match the place's city. Use 'other' for anywhere outside Tampa, St Petersburg, Clearwater, Brandon, Bradenton, Safety Harbor, or Dunedin.
- "category" must be one of: restaurant, brewery, bar, cafe, bakery, museum, gallery, park, beach, shop, venue, attraction, other.
- "priceRange" should be '$', '$$', '$$$', or '$$$$' based on the page content. Null if not stated.
- "vibes" should include applicable attributes from: dog_friendly, outdoor_seating, kid_friendly, family, late_night, romantic, hidden_gem, waterfront, live_music, craft_beer, brunch, vegan_friendly, pet_friendly, scenic_views. Only include vibes explicitly supported by the page content.
- "hoursJson" should be an array of human-readable strings like "Mon-Fri 11am-10pm". Null if hours are not on the page.`;

export function buildPlaceUserPrompt(args: {
  sourceLabel: string;
  url: string;
  reducedHtml: string;
}): string {
  return `Source: ${args.sourceLabel}
URL: ${args.url}

Extract the place from the HTML below. If this page is not about a specific place, set isPlace=false.

HTML:
"""
${args.reducedHtml}
"""`;
}
