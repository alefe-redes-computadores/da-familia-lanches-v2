import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/adminAuth';
import { adminDb } from '@/lib/integration/server/admin';
import { isAdminEmail } from '@/lib/adminAuthorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
type Source = 'site' | 'entregas' | 'unknown';
const statuses = ['pending', 'processing', 'queued', 'failed', 'suppressed'] as const;
const empty = () => ({ pending: 0, processing: 0, queued: 0, failed: 0, suppressed: 0, other: 0 });
function sourceOf(data: Record<string, unknown>): Source {
  if (data.messaging_source === 'entregas') return 'entregas';
  if (data.messaging_source === 'site') return 'site';
  if (typeof data.source_event_type === 'string' && data.source_event_type.startsWith('delivery.')) return 'entregas';
  return 'unknown';
}
function iso(value: unknown) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try { return (value as { toDate: () => Date }).toDate().toISOString(); } catch { return null; }
  }
  return null;
}
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!bearer) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
  try {
    const decoded = await adminAuth.verifyIdToken(bearer, true);
    if (!isAdminEmail(decoded.email)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  } catch { return json({ ok: false, error: 'AUTH_REQUIRED' }, 401); }

  try {
    // Small on-demand sample; no listener, polling, unbounded scan, or writes.
    const LIMIT = 100;
    const snap = await adminDb.collection('integration_notification_intents').orderBy('created_at', 'desc').limit(LIMIT).get();
    const summary = { site: empty(), entregas: empty(), unknown: empty() };
    const latest: Record<Source, string | null> = { site: null, entregas: null, unknown: null };
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const source = sourceOf(data);
      const status = String(data.status || '').trim().toLowerCase();
      if ((statuses as readonly string[]).includes(status)) {
        const key = status as typeof statuses[number];
        summary[source][key]++;
      } else { summary[source].other++; }
      const when = iso(data.created_at);
      if (when && (!latest[source] || when > latest[source]!)) latest[source] = when;
    }
    return json({
      ok: true, checkedAt: new Date().toISOString(), sample: snap.size,
      sampleLimit: LIMIT, truncated: snap.size >= LIMIT,
      gates: {
        manualInboundEnabled: process.env.DFL_MANUAL_MESSAGING_ENABLED === 'true',
        ingestConfigured: Boolean(process.env.DFL_MESSAGING_INGEST_URL?.trim() && process.env.DFL_MESSAGING_INGEST_TOKEN?.trim()),
        workerConfigured: Boolean(process.env.DFL_MESSAGING_WORKER_URL?.trim() && process.env.DFL_MESSAGING_WORKER_TOKEN?.trim()),
        siteToEntregasRelayEnabled: process.env.DFL_INTEGRATION_RELAY_ENABLED === 'true',
      },
      summary, latest,
      note: 'Amostra de intenções do Firestore, não o log do provedor. queued não significa entregue.',
    });
  } catch { return json({ ok: false, error: 'DIAGNOSTIC_UNAVAILABLE' }, 503); }
}
