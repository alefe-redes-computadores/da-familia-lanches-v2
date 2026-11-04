import { NextRequest, NextResponse } from 'next/server';
import { callEntregas, isSafeTrackingRequest, sealScope, trackingCookieName, trackingCookiePath, trackingEnabled, trackingFailure, trackingNoStoreHeaders } from '@/lib/tracking/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const deny = (code = 404) => NextResponse.json(trackingFailure, { status: code, headers: trackingNoStoreHeaders });
export async function POST(request: NextRequest) {
  if (!trackingEnabled() || !isSafeTrackingRequest(request, true)) return deny();
  try {
    const raw = await request.text();
    if (raw.length > 130 || raw.length < 20) return deny(422);
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).length !== 1 || typeof (input as {token?: unknown}).token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test((input as {token:string}).token)) return deny(422);
    const remote = await callEntregas('/api/integration/tracking/v1/authorize', {
      contract:'dfl.tracking.access', version:1, action:'exchange', opaque_token:(input as {token:string}).token,
    });
    if (!remote.ok || !remote.data || typeof remote.data !== 'object') return deny();
    const data = remote.data as Record<string, unknown>;
    if (Object.keys(data).length !== 5 || data.contract !== 'dfl.tracking.access' || data.version !== 1 || data.authorized !== true ||
        typeof data.scope_handle !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.scope_handle) ||
        typeof data.scope_expires_at !== 'string' || !Number.isFinite(Date.parse(data.scope_expires_at)) ||
        Date.parse(data.scope_expires_at) > Date.now()+31*60_000) return deny();
    const sealed = sealScope(data.scope_handle, data.scope_expires_at);
    if (!sealed) return deny();
    const response = NextResponse.json({ok:true}, {headers:trackingNoStoreHeaders});
    response.cookies.set(trackingCookieName, sealed, {
      httpOnly: true, secure: true, sameSite: 'lax', path: trackingCookiePath, maxAge: 1800,
    });
    return response;
  } catch { return deny(); }
}
