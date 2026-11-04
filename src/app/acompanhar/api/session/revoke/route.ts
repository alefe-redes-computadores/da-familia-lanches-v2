import { NextRequest, NextResponse } from 'next/server';
import { isSafeTrackingRequest, trackingCookieName, trackingCookiePath, trackingNoStoreHeaders } from '@/lib/tracking/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!isSafeTrackingRequest(request, true)) return NextResponse.json({ok:false},{status:404,headers:trackingNoStoreHeaders});
  const response = NextResponse.json({ok:true},{headers:trackingNoStoreHeaders});
  response.cookies.set(trackingCookieName,'',{httpOnly:true,secure:true,sameSite:'lax',path:trackingCookiePath,maxAge:0});
  return response;
}
