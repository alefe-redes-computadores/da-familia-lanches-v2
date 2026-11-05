/** R264: parse only a staff-issued same-origin tracking URL. Never infer entitlement from order IDs. */
export function parseTrackingLink(raw: string, currentOrigin: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048 || raw.trim() !== raw) return null;
  try {
    const url = new URL(raw);
    // Public links are issued for the apex domain. When Meus pedidos is open on
    // www, navigate directly to apex with the fragment still client-side.
    // Never use an HTTP redirect, query parameter, or a third-party origin.
    const apex = 'https://dafamilialanches.com.br';
    const www = 'https://www.dafamilialanches.com.br';
    const allowedOrigin = currentOrigin === apex || currentOrigin === www ? apex : currentOrigin;
    if (url.origin !== allowedOrigin || url.protocol !== 'https:' ||
      url.username || url.password || url.pathname !== '/acompanhar' || url.search) return null;
    if (!/^#t=[A-Za-z0-9_-]{43}$/.test(url.hash)) return null;
    return url.href;
  } catch { return null; }
}
