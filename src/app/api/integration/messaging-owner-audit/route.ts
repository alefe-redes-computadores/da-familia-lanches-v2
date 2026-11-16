/** R75 P1: signed Entregas -> Site -> existing R34 Supabase audit, read-only.
 * This endpoint never ingests, wakes workers, sends messages or issues tracking tokens.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertSignedIntegrationRequest } from '@/lib/integration/server/signature';
import { R34_AUDIT_URL, r34ValidQuery, r34ValidAuditReply, type R34Query } from '@/lib/messaging/r34AuditPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = { 'cache-control': 'private, no-store, max-age=0', 'pragma': 'no-cache', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
const ID = /^dfl-[A-Za-z0-9-]{12,120}$/;
const envelopeKeys = ['event_id', 'source', 'order_id', 'event_type'];
export async function POST(req: NextRequest) {
  if (!(req.headers.get('content-type') || '').startsWith('application/json')) return reply({ ok: false, code: 'INVALID_CONTENT_TYPE' }, 415);
  let raw = '';
  try { raw = await req.text(); } catch { return reply({ ok: false, code: 'INVALID_BODY' }, 400); }
  if (raw.length < 40 || raw.length > 512) return reply({ ok: false, code: 'INVALID_BODY_LENGTH' }, 413);
  let obj: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ ok: false, code: 'INVALID_ENVELOPE' }, 422);
    obj = parsed as Record<string, unknown>;
  } catch { return reply({ ok: false, code: 'INVALID_ENVELOPE' }, 422); }
  if (Object.keys(obj).length !== 4 || !Object.keys(obj).every(key => envelopeKeys.includes(key))) return reply({ ok: false, code: 'INVALID_ENVELOPE' }, 422);
  const orderId = obj.order_id;
  if (typeof orderId !== 'string' || !orderId.startsWith('entregas:') || !ID.test(orderId.slice('entregas:'.length)) ||
      obj.source !== 'manual' || obj.event_type !== 'all' ||
      obj.event_id !== `r75-owner-audit-v1__${orderId.slice('entregas:'.length)}`) return reply({ ok: false, code: 'INVALID_OWNER_AUDIT_QUERY' }, 422);
  try {
    assertSignedIntegrationRequest({ body: raw, timestamp: req.headers.get('x-dfl-timestamp'),
      signature: req.headers.get('x-dfl-signature'), eventId: req.headers.get('x-dfl-event-id'), expectedEventId: String(obj.event_id) });
  } catch { return reply({ ok: false, code: 'UNAUTHORIZED_OWNER_AUDIT' }, 401); }
  const query: R34Query = { source: 'manual', orderId, eventType: 'all' };
  if (!r34ValidQuery(query)) return reply({ ok: false, code: 'INVALID_OWNER_AUDIT_QUERY' }, 422);
  const token = process.env.DFL_MESSAGING_WORKER_TOKEN?.trim() || '';
  if (token.length < 24 || token.length > 512) return reply({ ok: false, code: 'AUDIT_NOT_CONFIGURED' }, 503);
  try {
    const res = await fetch(R34_AUDIT_URL, { method: 'POST', cache: 'no-store', redirect: 'error', credentials: 'omit',
      signal: AbortSignal.timeout(5500),
      headers: { 'content-type': 'application/json', 'accept': 'application/json', 'x-dfl-messaging-worker-token': token },
      body: JSON.stringify({ contract: 'dfl.messaging.audit.v1', version: 1, source: query.source, order_id: query.orderId, event_type: query.eventType }),
    });
    if (!res.ok) return reply({ ok: false, code: 'SUPABASE_AUDIT_UNAVAILABLE' }, 503);
    if (!(res.headers.get('content-type') || '').includes('application/json')) return reply({ ok: false, code: 'INVALID_AUDIT_RESPONSE' }, 502);
    const dataRaw = await res.text();
    if (dataRaw.length < 40 || dataRaw.length > 12000) return reply({ ok: false, code: 'INVALID_AUDIT_RESPONSE' }, 502);
    const data: unknown = JSON.parse(dataRaw);
    if (!r34ValidAuditReply(data, query)) return reply({ ok: false, code: 'INVALID_AUDIT_RESPONSE' }, 502);
    return reply(data);
  } catch { return reply({ ok: false, code: 'AUDIT_TIMEOUT_OR_UNAVAILABLE' }, 503); }
}
