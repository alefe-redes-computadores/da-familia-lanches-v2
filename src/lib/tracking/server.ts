import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';

const ACCESS_PATH = '/api/integration/tracking/v1/authorize';
const STATUS_PATH = '/api/integration/tracking/v1/status';
const AUTO_ACCEPT_PATH = '/api/integration/tracking/v1/auto/accept';
const COOKIE_NAME = '__Secure-dfl-tracking-session';
const TTL_SECONDS = 30 * 60;
export const trackingCookieName = COOKIE_NAME;
export const trackingCookiePath = '/acompanhar/api';

export function trackingEnabled() {
  return process.env.DFL_SITE_TRACKING_ENABLED === '1';
}
function configuration() {
  if (!trackingEnabled()) return null;
  const origin = process.env.DFL_ENTREGAS_TRACKING_ORIGIN || '';
  const tenant = process.env.DFL_TRACKING_TENANT_ID || '';
  const kid = process.env.DFL_TRACKING_S2S_KID || '';
  const secret = process.env.DFL_TRACKING_S2S_SECRET || '';
  const encKey = process.env.DFL_SITE_TRACKING_COOKIE_KEY || '';
  let key: Buffer;
  try { key = Buffer.from(encKey, 'base64url'); } catch { return null; }
  if (key.length !== 32 || secret.length < 32 || !/^[A-Za-z0-9_-]{4,64}$/.test(tenant) ||
      !/^[A-Za-z0-9_-]{3,24}$/.test(kid)) return null;
  try {
    const u = new URL(origin);
    // No arbitrary forwarded host, URL path, redirects or insecure production transport.
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password ||
        u.pathname !== '/' || u.search || u.hash || u.port) return null;
    return { origin: u.origin, tenant, kid, secret, key };
  } catch { return null; }
}
export function isSafeTrackingRequest(request: NextRequest, write: boolean) {
  const host = request.headers.get('host') || '';
  const forwardedHost = request.headers.get('x-forwarded-host') || '';
  const canonical = process.env.DFL_SITE_TRACKING_PUBLIC_HOST || 'dafamilialanches.com.br';
  if (host !== canonical || (forwardedHost && forwardedHost !== canonical)) return false;
  if (!write) return true;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  const contentType = request.headers.get('content-type') || '';
  if (origin !== `https://${canonical}` || (site && site !== 'same-origin') ||
      !contentType.startsWith('application/json')) return false;
  return true;
}
const sha = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');
export async function callEntregas(path: typeof ACCESS_PATH | typeof STATUS_PATH | typeof AUTO_ACCEPT_PATH, body: Record<string, unknown>) {
  const conf = configuration();
  if (!conf) return { ok: false as const, status: 503, data: null };
  const raw = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const nonce = randomBytes(24).toString('base64url');
  const input = ['POST', path, sha(raw), timestamp, nonce, conf.kid, conf.tenant].join('\n');
  const signature = createHmac('sha256', conf.secret).update(input).digest('hex');
  try {
    const response = await fetch(conf.origin + path, {
      method: 'POST', cache: 'no-store', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(8000),
      headers: {
        'content-type': 'application/json', 'accept': 'application/json',
        'x-dfl-tracking-timestamp': timestamp,
        'x-dfl-tracking-nonce': nonce,
        'x-dfl-tracking-kid': conf.kid,
        'x-dfl-tracking-signature': signature,
      },
      body: raw,
    });
    if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json'))
      return { ok: false as const, status: response.status, data: null };
    const data: unknown = await response.json();
    return { ok: true as const, status: response.status, data };
  } catch {
    // Never log credentials, bodies, URL fragments, response contents or scope handles.
    return { ok: false as const, status: 503, data: null };
  }
}
export function sealScope(handle: string, expiresAt: string) {
  const conf = configuration();
  const remoteExpiry = Date.parse(expiresAt);
  if (!conf || !Number.isFinite(remoteExpiry) || remoteExpiry <= Date.now() ||
      !/^[A-Za-z0-9_-]{22,128}$/.test(handle)) return null;
  const expiration = Math.min(remoteExpiry, Date.now() + TTL_SECONDS * 1000);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', conf.key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ v: 1, handle, exp: expiration })), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
export function unsealScope(cookie: string | undefined) {
  const conf = configuration();
  if (!conf || !cookie || cookie.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cookie)) return null;
  try {
    const [a, b, c] = cookie.split('.');
    const iv = Buffer.from(a, 'base64url'), tag = Buffer.from(b, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', conf.key, iv);
    decipher.setAuthTag(tag);
    const value: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(c, 'base64url')), decipher.final()]).toString('utf8'));
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    if (data.v !== 1 || typeof data.handle !== 'string' || !/^[A-Za-z0-9_-]{22,128}$/.test(data.handle) ||
        typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp <= Date.now() ||
        data.exp > Date.now() + TTL_SECONDS * 1000) return null;
    return data.handle;
  } catch { return null; }
}
export const trackingNoStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
export const trackingFailure = { error: 'TRACKING_UNAVAILABLE', message: 'Não foi possível acessar o acompanhamento. Confira o link ou tente mais tarde.' };
export function validPublicProjection(value: unknown): value is PublicTracking {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const shape = (x: unknown, keys: string[]) => Boolean(x && typeof x === 'object' && !Array.isArray(x) &&
    Object.keys(x).length === keys.length && Object.keys(x).every(k => keys.includes(k)));
  const kinds = ['received','scheduled','confirmed','preparing','ready','assigned','out_for_delivery','reorganized','next_stop','delivered','delivery_issue','cancelled'];
  const titles: Record<string,string> = { received:'Pedido recebido',scheduled:'Pedido agendado',confirmed:'Pedido confirmado',preparing:'Em preparação',ready:'Pedido pronto',assigned:'Organizado para entrega',out_for_delivery:'Saiu para entrega',reorganized:'Rota reorganizada',next_stop:'Próxima parada',delivered:'Pedido entregue',delivery_issue:'Intercorrência na entrega',cancelled:'Pedido cancelado' };
  const statuses = kinds.filter(k => k !== 'reorganized');
  if (!shape(v, ['contract','version','order','status','as_of','freshness','timeline','progress','courier','terminal']) ||
      v.contract !== 'dfl.tracking.public' || v.version !== 1 || !statuses.includes(String(v.status)) ||
      !['fresh','stale','reconciling','unknown'].includes(String(v.freshness)) ||
      !validDate(v.as_of) || typeof v.terminal !== 'boolean' ||
      v.terminal !== (v.status === 'delivered' || v.status === 'cancelled')) return false;
  if (!shape(v.order, ['label','origin_label','fulfillment'])) return false;
  const order = v.order as Record<string, unknown>;
  if (typeof order.label !== 'string' || !order.label || order.label.length > 32 ||
      typeof order.origin_label !== 'string' || !order.origin_label || order.origin_label.length > 40 ||
      !['delivery','pickup'].includes(String(order.fulfillment))) return false;
  if (!Array.isArray(v.timeline) || v.timeline.length > 30) return false;
  const ids = new Set<string>();
  for (const event of v.timeline) {
    if (!shape(event, ['id','kind','title','at'])) return false;
    const e = event as Record<string, unknown>;
    if (typeof e.id !== 'string' || !/^[A-Za-z0-9._:/-]{1,128}$/.test(e.id) || ids.has(e.id) ||
        !kinds.includes(String(e.kind)) || typeof e.title !== 'string' || e.title !== titles[String(e.kind)] || !validDate(e.at)) return false;
    ids.add(e.id);
  }
  if (v.courier !== null) {
    if (!shape(v.courier, ['first_name'])) return false;
    const c = v.courier as Record<string, unknown>;
    if (typeof c.first_name !== 'string' || !/^[\p{L}\p{M}'-]{1,40}$/u.test(c.first_name)) return false;
  }
  if (v.progress !== null) {
    if (!shape(v.progress, ['status','current_stop_number','planned_customer_stop_number','total_physical_stops','stops_ahead','is_next_stop'])) return false;
    const p = v.progress as Record<string, unknown>;
    const between = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
    if (v.status !== 'out_for_delivery' || v.freshness !== 'fresh' || p.status !== 'verified' ||
        !between(p.total_physical_stops, 1, 300) || !between(p.planned_customer_stop_number, 1, p.total_physical_stops as number) ||
        !between(p.stops_ahead, 0, (p.total_physical_stops as number)-1) ||
        typeof p.is_next_stop !== 'boolean' || p.is_next_stop !== (p.stops_ahead === 0) ||
        (p.current_stop_number !== null && !between(p.current_stop_number, 1, p.total_physical_stops as number))) return false;
  }
  if (v.freshness !== 'fresh' && v.progress !== null) return false;
  return true;
}
function validDate(v: unknown) {
  return typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
}
export type PublicTracking = {
  contract: 'dfl.tracking.public'; version: 1;
  order: { label: string; origin_label: string; fulfillment: 'delivery' | 'pickup' };
  status: 'received'|'scheduled'|'confirmed'|'preparing'|'ready'|'assigned'|'out_for_delivery'|'next_stop'|'delivered'|'delivery_issue'|'cancelled';
  as_of: string; freshness: 'fresh'|'stale'|'reconciling'|'unknown';
  timeline: {id:string;kind:string;title:string;at:string}[];
  progress: null | {status:'verified';current_stop_number:number|null;planned_customer_stop_number:number|null;total_physical_stops:number;stops_ahead:number|null;is_next_stop:boolean};
  courier: {first_name:string}|null; terminal:boolean;
};
