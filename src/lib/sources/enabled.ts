interface SourceEnabledRow {
  slug: string;
  enabled: boolean;
}

export function filterEnabledAdapters<T extends { slug: string }>(
  adapters: T[],
  rows: SourceEnabledRow[],
): T[] {
  const enabledBySlug = new Map<string, boolean>(
    rows.map((row) => [row.slug, row.enabled]),
  );
  return adapters.filter((adapter) => enabledBySlug.get(adapter.slug) !== false);
}
