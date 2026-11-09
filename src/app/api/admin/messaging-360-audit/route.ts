/** R34 — Firebase-admin, one-shot, server-only proxy to read-only Supabase audit. */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth} from '@/lib/integration/server/adminAuth';
import {isAdminEmail} from '@/lib/adminAuthorization';
import {R34_AUDIT_URL,r34ValidQuery,r34ValidAuditReply,type R34Query} from '@/lib/messaging/r34AuditPolicy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:HEADERS});
export async function GET(req:NextRequest){
 const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
 if(!bearer)return reply({ok:false,code:'AUTH_REQUIRED'},401);
 try{
  const claims=await adminAuth.verifyIdToken(bearer,true);
  if(!claims.email||!isAdminEmail(claims.email))return reply({ok:false,code:'FORBIDDEN'},403);
 }catch{return reply({ok:false,code:'AUTH_REQUIRED'},401);}
 const q={source:req.nextUrl.searchParams.get('source'),orderId:req.nextUrl.searchParams.get('orderId'),eventType:req.nextUrl.searchParams.get('eventType')||'all'};
 if(!r34ValidQuery(q))return reply({ok:false,code:'INVALID_AUDIT_QUERY'},422);
 const query=q as R34Query;
 const token=process.env.DFL_MESSAGING_WORKER_TOKEN?.trim()||'';
 if(token.length<24)return reply({ok:false,code:'MESSAGING_AUDIT_NOT_CONFIGURED'},503);
 try{
  const res=await fetch(R34_AUDIT_URL,{
   method:'POST',cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(5500),
   headers:{'content-type':'application/json','accept':'application/json','x-dfl-messaging-worker-token':token},
   body:JSON.stringify({contract:'dfl.messaging.audit.v1',version:1,source:query.source,order_id:query.orderId,event_type:query.eventType}),
  });
  if(!res.ok)return reply({ok:false,code:res.status===401?'SUPABASE_AUDIT_AUTH_MISMATCH':'SUPABASE_AUDIT_UNAVAILABLE'},503);
  if(!(res.headers.get('content-type')||'').includes('application/json'))return reply({ok:false,code:'INVALID_AUDIT_REPLY'},502);
  const raw=await res.text();
  if(raw.length<40||raw.length>12000)return reply({ok:false,code:'INVALID_AUDIT_REPLY'},502);
  const data:unknown=JSON.parse(raw);
  if(!r34ValidAuditReply(data,query))return reply({ok:false,code:'INVALID_AUDIT_REPLY'},502);
  return reply(data);
 }catch{return reply({ok:false,code:'SUPABASE_AUDIT_TIMEOUT_OR_UNAVAILABLE'},503);}
}
