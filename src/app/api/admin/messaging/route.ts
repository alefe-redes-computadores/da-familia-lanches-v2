import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/adminAuth';
import { adminDb } from '@/lib/integration/server/admin';
import { isAdminEmail } from '@/lib/adminAuthorization';
import { evaluateManualRetry } from '@/lib/messaging/retryPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// MSG-M3: consulta explícita, sem listener, sem mutações e sem dados brutos de contato.
const MAX_ROWS = 80;
const COLLECTION = 'integration_notification_intents';
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: HEADERS });
const str = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max);
const statusLabel = (value: unknown) => {
  const label = str(value, 30).toLowerCase();
  return ['pending', 'processing', 'queued', 'failed', 'suppressed'].includes(label) ? label : 'unknown';
};
function maskPhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : 'Não informado';
}
function isoDate(value: unknown) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    } catch { return null; }
  }
  return null;
}
function errorClass(value: unknown): string | null {
  const message = str(value, 500).toLowerCase();
  if (!message) return null;
  if (/timeout|timed out|abort/.test(message)) return 'tempo_esgotado';
  if (/401|403|unauthoriz|forbidden|token|permission/.test(message)) return 'autorizacao';
  if (/429|rate.?limit|quota/.test(message)) return 'limite';
  if (/missing|invalid|incomplet|sem dados/.test(message)) return 'dados_invalidos';
  if (/network|fetch|unavailable|conect|503|502|500/.test(message)) return 'servico_indisponivel';
  return 'falha_no_processamento';
}

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!token) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
  let requesterUid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    if (!isAdminEmail(decoded.email)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
    requesterUid = decoded.uid;
  } catch { return json({ ok: false, error: 'AUTH_REQUIRED' }, 401); }

  try {
    const snap = await adminDb.collection(COLLECTION).orderBy('created_at', 'desc').limit(MAX_ROWS).get();
    const rows = snap.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>;
      const orderId = str(data.order_id, 140);
      const retry = evaluateManualRetry({status:data.status,error:data.last_error,manualRetryCount:data.manual_retry_count,manualRetryAt:data.manual_retry_at,createdAt:data.created_at});
      return {
        id: doc.id.slice(0, 200),
        orderId,
        orderLabel: orderId ? `#${orderId.slice(-8).toUpperCase()}` : 'Sem pedido',
        customerName: str(data.customer_name, 70) || 'Cliente não identificado',
        phoneMasked: maskPhone(data.customer_phone),
        event: str(data.messaging_event_type || data.intent_type, 45) || 'evento_indefinido',
        source: str(data.messaging_source, 16) === 'entregas' ? 'entregas' : 'site',
        status: statusLabel(data.status),
        eligible: data.messaging_eligible === true,
        attempts: Math.min(99, Math.max(0, Math.trunc(Number(data.attempts) || 0))),
        createdAt: isoDate(data.created_at),
        updatedAt: isoDate(data.updated_at),
        reason: str(data.suppressed_reason, 100) || null,
        errorClass: errorClass(data.last_error),
        retry,
      };
    });
    return json({
      ok: true, checkedAt: new Date().toISOString(), rows,
      limit: MAX_ROWS, truncated: snap.size >= MAX_ROWS,
      manualBridgeEnabled: process.env.DFL_MANUAL_MESSAGING_ENABLED === 'true',
      retryConfigured: process.env.DFL_MESSAGING_MANUAL_RETRY_ENABLED === 'true' && Boolean(process.env.DFL_MESSAGING_RETRY_OWNER_UID?.trim()),
      retryLimit: 2,
      retryEnabled: process.env.DFL_MESSAGING_MANUAL_RETRY_ENABLED === 'true' && Boolean(process.env.DFL_MESSAGING_RETRY_OWNER_UID?.trim()) && requesterUid === process.env.DFL_MESSAGING_RETRY_OWNER_UID?.trim(),
      note: 'Status queued indica aceitação na fila, não entrega no WhatsApp. Dados limitados a intenções no Site.',
    });
  } catch {
    return json({ ok: false, error: 'Não foi possível consultar a mensageria.' }, 503);
  }
}
