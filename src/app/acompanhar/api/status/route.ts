import { NextRequest, NextResponse } from 'next/server';
import { callEntregas, isSafeTrackingRequest, trackingEnabled, trackingCookieName, unsealScope, validPublicProjection, trackingFailure, trackingNoStoreHeaders } from '@/lib/tracking/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const deny = (code = 404) => NextResponse.json(trackingFailure, { status:code,headers:trackingNoStoreHeaders });
export async function GET(request:NextRequest) {
  if (!trackingEnabled() || !isSafeTrackingRequest(request,false)) return deny();
  const scope = unsealScope(request.cookies.get(trackingCookieName)?.value);
  if (!scope) return deny(401);
  const result = await callEntregas('/api/integration/tracking/v1/status', {
    contract:'dfl.tracking.access',version:1,action:'status',scope_handle:scope,
  });
  if (!result.ok || !validPublicProjection(result.data)) return deny(result.status === 503 ? 503 : 404);
  return NextResponse.json(result.data, {headers:trackingNoStoreHeaders});
}
