/** Matches API slugifyName — used for integration ?product= preview in admin UI */
export function slugifyProductKey(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'service';
}
