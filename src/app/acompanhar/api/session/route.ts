import { NextRequest, NextResponse } from 'next/server';
import { callEntregas, isSafeTrackingRequest, sealScope, sealTrackingBinding, matchingTrackingScope, trackingCookieName, trackingBindingCookieName, trackingCookiePath, trackingEnabled, trackingFailure, trackingNoStoreHeaders, validPublicProjection } from '@/lib/tracking/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const deny = (code = 404) => NextResponse.json(trackingFailure, { status: code, headers: trackingNoStoreHeaders });
const denyAndClear = (code = 404) => {
  const reply=deny(code);
  for(const name of [trackingCookieName,trackingBindingCookieName])
    reply.cookies.set(name,'',{httpOnly:true,secure:true,sameSite:'lax',path:trackingCookiePath,maxAge:0});
  return reply;
};
export async function POST(request: NextRequest) {
  if (!trackingEnabled() || !isSafeTrackingRequest(request, true)) return deny();
  try {
    const raw = await request.text();
    if (raw.length > 130 || raw.length < 20) return deny(422);
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).length !== 1 || typeof (input as {token?: unknown}).token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test((input as {token:string}).token)) return deny(422);
    // A second opening of this SAME link can reuse only a valid bound scope.
    // It must not revoke the existing browser session or reuse another order's cookie.
    const previous=matchingTrackingScope((input as {token:string}).token,
      request.cookies.get(trackingCookieName)?.value,
      request.cookies.get(trackingBindingCookieName)?.value);
    if(previous){
      const confirmed=await callEntregas('/api/integration/tracking/v1/status', {
        contract:'dfl.tracking.access',version:1,action:'status',scope_handle:previous,
      });
      if(confirmed.ok&&validPublicProjection(confirmed.data))
        return NextResponse.json({ok:true,reused:true},{headers:trackingNoStoreHeaders});
      // Network uncertainty is not a reason to destroy a valid local cookie.
      return confirmed.status===503?deny(503):denyAndClear();
    }
    const remote = await callEntregas('/api/integration/tracking/v1/authorize', {
      contract:'dfl.tracking.access', version:1, action:'exchange', opaque_token:(input as {token:string}).token,
    });
    if (!remote.ok || !remote.data || typeof remote.data !== 'object') return denyAndClear();
    const data = remote.data as Record<string, unknown>;
    if (Object.keys(data).length !== 5 || data.contract !== 'dfl.tracking.access' || data.version !== 1 || data.authorized !== true ||
        typeof data.scope_handle !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.scope_handle) ||
        typeof data.scope_expires_at !== 'string' || !Number.isFinite(Date.parse(data.scope_expires_at)) ||
        Date.parse(data.scope_expires_at) > Date.now()+31*60_000) return denyAndClear();
    const sealed = sealScope(data.scope_handle, data.scope_expires_at);
    const bound = sealTrackingBinding((input as {token:string}).token,data.scope_handle,data.scope_expires_at);
    if (!sealed || !bound) return denyAndClear(503);
    const response = NextResponse.json({ok:true}, {headers:trackingNoStoreHeaders});
    response.cookies.set(trackingCookieName, sealed, {
      httpOnly: true, secure: true, sameSite: 'lax', path: trackingCookiePath, maxAge: 1800,
    });
    response.cookies.set(trackingBindingCookieName, bound, {
      httpOnly:true,secure:true,sameSite:'lax',path:trackingCookiePath,maxAge:1800,
    });
    return response;
  } catch { return deny(); }
}
