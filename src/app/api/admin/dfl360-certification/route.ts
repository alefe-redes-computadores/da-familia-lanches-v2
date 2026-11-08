/** R29 — on-demand owner/admin preflight. GET only, protected, never sends. */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth} from '@/lib/integration/server/adminAuth';
import {isAdminEmail} from '@/lib/adminAuthorization';
import {r29ReadCertification} from '@/lib/tracking/r29CertificationServer';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
export async function GET(request:NextRequest){
  const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!bearer)return reply({ok:false,code:'AUTH_REQUIRED'},401);
  try{
    const claims=await adminAuth.verifyIdToken(bearer,true);
    if(!claims.email||!isAdminEmail(claims.email))return reply({ok:false,code:'FORBIDDEN'},403);
  }catch{return reply({ok:false,code:'AUTH_REQUIRED'},401);}
  try{return reply(await r29ReadCertification(request.nextUrl.searchParams.get('probe')==='1'));}
  catch{return reply({ok:false,code:'PREFLIGHT_UNAVAILABLE'},503);}
}
