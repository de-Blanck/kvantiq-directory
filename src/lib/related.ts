export interface RelatedItem {
  slug: string;
  name: string;
  description: string;
  collection: string;
  tags: string[];
  href: string;
}

/**
 * Find related items across all collections by shared tags.
 * An item is "related" if it shares 2+ tags with the current entry.
 * Runs at build time in .astro pages — do NOT import in React components.
 */
export function findRelated(
  currentSlug: string,
  currentTags: string[],
  allItems: RelatedItem[],
  maxItems = 6
): RelatedItem[] {
  const tagSet = new Set(currentTags);

  return allItems
    .filter(item => item.slug !== currentSlug)
    .map(item => ({
      ...item,
      sharedCount: item.tags.filter(t => tagSet.has(t)).length,
    }))
    .filter(item => item.sharedCount >= 2)
    .sort((a, b) => b.sharedCount - a.sharedCount)
    .slice(0, maxItems);
}
