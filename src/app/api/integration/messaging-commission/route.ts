import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { assertSignedIntegrationRequest } from '@/lib/integration/server/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'cache-control': 'private, no-store, max-age=0' };
const reply = (data: unknown, status = 200) => NextResponse.json(data, {status, headers});
const protocol = 'dfl.messaging.pilot.v1';
const supported = new Set(['probe', 'pilot_preflight', 'pilot_send']);

function dayInBrazil() {
  const date = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return date.replace(/\D/g, '');
}
function safeEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) return null;
    return url.toString();
  } catch {return null;}
}
function testNumber() {
  const value = String(process.env.DFL_MESSAGING_PILOT_PHONE_E164 || '').trim();
  return /^55[1-9]\d{9,10}$/.test(value) ? value : null;
}
function digest(value: string) {return createHash('sha256').update(value).digest('hex');}

export async function POST(req: NextRequest) {
  let body = '';
  try { body = await req.text(); } catch { return reply({ok:false,code:'INVALID_BODY'},400); }
  if (body.length < 25 || body.length > 700) return reply({ok:false,code:'INVALID_SIZE'},413);
  let input: Record<string,unknown>;
  try {
    const value: unknown = JSON.parse(body);
    if (!value || Array.isArray(value) || typeof value !== 'object') return reply({ok:false,code:'INVALID_JSON'},400);
    input = value as Record<string,unknown>;
  } catch { return reply({ok:false,code:'INVALID_JSON'},400); }
  const action = String(input.action||'');
  const eventId = String(input.event_id||'');
  const day = String(input.day||'');
  if (input.protocol !== protocol || !supported.has(action) || !/^\d{8}$/.test(day) ||
    day !== dayInBrazil() || !/^dfl-pilot-[A-Za-z0-9-]{12,90}$/.test(eventId) ||
    String(input.source||'') !== 'dfl_entregas') return reply({ok:false,code:'INVALID_PROBE'},422);
  try {
    assertSignedIntegrationRequest({body,
      timestamp:req.headers.get('x-dfl-timestamp'), signature:req.headers.get('x-dfl-signature'),
      eventId:req.headers.get('x-dfl-event-id'),expectedEventId:eventId});
  } catch { return reply({ok:false,code:'INVALID_SIGNATURE'},401); }
  if (action === 'probe') return reply({ok:true,code:'BRIDGE_HMAC_VERIFIED',deliveryVerified:false});

  // Independent, explicit enablement is required on BOTH services. No general
  // customer messaging flag is changed or inferred by this diagnostic route.
  const phone = testNumber();
  const configured = process.env.DFL_MESSAGING_PILOT_ENABLED === 'true' && phone !== null &&
    process.env.DFL_MESSAGING_INGEST_TOKEN?.trim() &&
    safeEndpoint(process.env.DFL_MESSAGING_INGEST_URL || '');
  if (!configured) return reply({ok:false,code:'PILOT_NOT_CONFIGURED'},403);
  if (input.phone_sha256 !== digest(phone!)) return reply({ok:false,code:'PILOT_ALLOWLIST_MISMATCH'},403);
  if (action === 'pilot_preflight') return reply({ok:true,code:'PILOT_PREFLIGHT_OK',deliveryVerified:false});

  const ingest = safeEndpoint(process.env.DFL_MESSAGING_INGEST_URL || '');
  if (!ingest) return reply({ok:false,code:'INGEST_NOT_CONFIGURED'},503);
  // This is intentionally a synthetic event with a deterministic daily order
  // identity. Deduplication in the ingest is semantic (event type + order ID).
  // NEVER use real customer/order data or a phone supplied by a caller.
  const payload = {
    source:'system',source_event_id:`dfl-pilot-v1-${day}`,
    event_type:'order.created',order_id:`DFL-HML-${day}`,
    customer_phone:phone,customer_name:'TESTE DE HOMOLOGACAO - NAO E PEDIDO REAL',
    payload:{customer_name:'TESTE DE HOMOLOGACAO - NAO E PEDIDO REAL',
      order_number:`HML${day.slice(4)}`,fulfillment:'delivery',total:0,
      items:[{name:'TESTE DE INTEGRACAO - NAO E PEDIDO REAL',quantity:1,unitPrice:0}]},
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(ingest, {method:'POST',cache:'no-store',signal:controller.signal,
      headers:{'content-type':'application/json','x-dfl-messaging-token':process.env.DFL_MESSAGING_INGEST_TOKEN!.trim()},
      body:JSON.stringify(payload)});
    const result = await response.json().catch(() => null) as {ok?:unknown;queued?:unknown;duplicate?:unknown}|null;
    if (!response.ok || result?.ok !== true) return reply({ok:false,code:'INGEST_REJECTED',httpStatus:response.status},503);
    return reply({ok:true,code:result.duplicate===true?'ALREADY_ENQUEUED':'TEST_ENQUEUED',
      queued:result.queued===true,duplicate:result.duplicate===true,
      providerDelivered:false,note:'Apenas fila Supabase; aguardar worker e verificar WhatsApp de teste.'});
  } catch { return reply({ok:false,code:'INGEST_UNAVAILABLE',deliveryUnknown:true},503); }
  finally {clearTimeout(timer);}
}
export async function GET(){return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);}
