export function getSlugs(key: string): string[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(entries) ? entries.filter((entry): entry is string =>
      typeof entry === 'string' && entry.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry)) : [];
  } catch {
    return [];
  }
}

export function storeSlugs(key: string, slugs: string[]) {
  try { localStorage.setItem(key, JSON.stringify(slugs)); } catch { /* Storage may be unavailable. */ }
}
