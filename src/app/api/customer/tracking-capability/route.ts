import { NextResponse } from 'next/server';
import { trackingEnabled, trackingNoStoreHeaders } from '@/lib/tracking/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  // Public boolean only. Feature remains invisible while the tracking kill switch is OFF.
  return NextResponse.json({enabled: trackingEnabled()}, {headers:trackingNoStoreHeaders});
}
