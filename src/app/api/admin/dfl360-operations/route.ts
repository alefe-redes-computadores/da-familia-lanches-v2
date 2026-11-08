/** R26 — owner/admin diagnostics, strictly read-only. */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth} from '@/lib/integration/server/adminAuth';
import {isAdminEmail} from '@/lib/adminAuthorization';
import {r26ReadOperations} from '@/lib/tracking/r26OperationsServer';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
export async function GET(request:NextRequest) {
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!token)return reply({ok:false,code:'AUTH_REQUIRED'},401);
  try {
    const claims=await adminAuth.verifyIdToken(token,true);
    if(!claims.email||!isAdminEmail(claims.email))return reply({ok:false,code:'FORBIDDEN'},403);
  }catch{return reply({ok:false,code:'AUTH_REQUIRED'},401);}
  try{return reply(await r26ReadOperations());}
  catch{return reply({ok:false,code:'DIAGNOSTIC_UNAVAILABLE'},503);}
}
