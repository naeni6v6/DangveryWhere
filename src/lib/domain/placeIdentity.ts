import aliases from '$lib/data/placeAliases.json';

/** Reviewed duplicates only. Keep old favorites and shared URLs usable. */
export function canonicalPlaceId(id: string): string {
  return (aliases as Record<string, string>)[id] ?? id;
}

export function canonicalPlaceIds(ids: string[]): string[] {
  return [...new Set(ids.map(canonicalPlaceId))];
}

export function placeIdVariants(id: string): string[] {
  const canonical = canonicalPlaceId(id);
  return [
    canonical,
    ...Object.keys(aliases).filter((alias) => canonicalPlaceId(alias) === canonical)
  ];
}
