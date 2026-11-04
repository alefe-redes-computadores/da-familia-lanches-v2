/** Owner-only diagnostic. No customer access. Strictly OFF without explicit staging env. */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/adminAuth';
import { bridgeConfiguration, probeEntregasBridge } from '@/lib/tracking/bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control':'private, no-store, max-age=0',
  'Pragma':'no-cache',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
};
const deny = (code: number) => NextResponse.json({ok:false,connected:false},{status:code,headers});

export async function POST(request: NextRequest) {
  const config = bridgeConfiguration();
  if (!config) return deny(404);
  // Do not trust Host-derived values or a caller-chosen upstream URL.
  const host = request.headers.get('host');
  const forwarded = request.headers.get('x-forwarded-host');
  const proto = request.headers.get('x-forwarded-proto');
  if (host !== config.host || (forwarded && forwarded !== config.host) ||
      (proto && proto !== 'https') || request.nextUrl.protocol !== 'https:') return deny(404);
  // No cookies or browser sessions authorize this endpoint; only a revoked-checked owner ID token.
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) return deny(403);
  try {
    const verified = await adminAuth.verifyIdToken(authorization.slice(7), true);
    if (verified.uid !== config.ownerUid) return deny(403);
  } catch { return deny(403); }
  // A diagnostic request must have an empty body; never accept credentials from the caller.
  if (Number(request.headers.get('content-length') || '0') > 0) return deny(422);
  const result = await probeEntregasBridge(config);
  return NextResponse.json({ok:true,connected:result.connected,public_access_granted:false,messages_sent:false},
    {status:result.connected?200:503,headers});
}
