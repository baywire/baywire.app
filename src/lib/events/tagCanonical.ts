const TAG_ALIASES: Record<string, string[]> = {
  arts: ["art"],
  art: ["art"],
  theatre: ["theater"],
  theater: ["theater"],
  films: ["film"],
  movies: ["film"],
  movie: ["film"],
  kids: ["family"],
  child: ["family"],
  children: ["family"],
  outdoor: ["outdoors"],
  outdoors: ["outdoors"],
  drink: ["drinks"],
  foods: ["food"],
  markets: ["market"],
  shopping: ["market"],
  festivals: ["festival"],
  musics: ["music"],
  concert: ["music"],
  concerts: ["music"],
  "live show": ["music"],
  "live music": ["music"],
  "r&b": ["music"],
};

export function normalizeCategoryTags(input: readonly string[], limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input) {
    for (const piece of splitCategoryTag(raw)) {
      const aliases = TAG_ALIASES[piece] ?? [piece];
      for (const alias of aliases) {
        if (!alias || alias.length > 16 || seen.has(alias)) continue;
        seen.add(alias);
        out.push(alias);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

function splitCategoryTag(raw: string): string[] {
  let tag = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!tag) return [];
  if (tag.includes("/")) {
    const [first] = tag.split("/");
    tag = first?.trim() ?? "";
  }
  if (!tag) return [];
  return tag
    .split(/\s+&\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
