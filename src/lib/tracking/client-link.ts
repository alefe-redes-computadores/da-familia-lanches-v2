/** R264: parse only a staff-issued same-origin tracking URL. Never infer entitlement from order IDs. */
export function parseTrackingLink(raw: string, currentOrigin: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048 || raw.trim() !== raw) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== currentOrigin || url.protocol !== 'https:' ||
      url.username || url.password || url.pathname !== '/acompanhar' || url.search) return null;
    if (!/^#t=[A-Za-z0-9_-]{43}$/.test(url.hash)) return null;
    return url.href;
  } catch { return null; }
}
