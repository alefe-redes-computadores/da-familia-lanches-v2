import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { buildThermalReceiptHtml } from '@/lib/thermalReceipt';
import { PRINT_JOB_MAX_AGE_MS, printOrderBlocked, type PrintTicketKind } from '@/lib/printing/printStationPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COLLECTION = 'integration_print_jobs';
const headers = { 'Cache-Control':'private, no-store, max-age=0', 'X-Content-Type-Options':'nosniff' };
const reply = (body:unknown, status=200) => NextResponse.json(body,{status,headers});
const sha256 = (value:string) => createHash('sha256').update(value).digest('hex');
const match = (a:string,b:string) => {
  const x=createHash('sha256').update(a).digest();
  const y=createHash('sha256').update(b).digest();
  return timingSafeEqual(x,y);
};
const configured = () => process.env.DFL_PRINT_AGENT_ENABLED === 'true' &&
  process.env.DFL_PRINT_AUTO_ENABLED === 'true' &&
  /^[A-Za-z0-9_-]{32,160}$/.test(process.env.DFL_PRINT_AGENT_TOKEN || '');
const validId = (id:unknown): id is string => typeof id==='string' && /^print-v1__site_[a-f0-9]{40}__(kitchen|full)$/.test(id);
const validClaim = (token:unknown): token is string => typeof token==='string' && /^[a-f0-9]{64}$/.test(token);

type JobRecord = { status?: string; order_id?: string; created_at?: string; kind?: PrintTicketKind;
  paper_mm?: '58'|'80'; claim_hash?: string; source?: string; protocol?: string };

async function claimNextJob() {
  // Firestore single-field index: no composite index or polling listener is required.
  const pending=await adminDb.collection(COLLECTION).where('status','==','pending').limit(8).get();
  if (pending.empty) return null;
  const candidates=[...pending.docs].sort((a,b)=>String(a.get('created_at')||'').localeCompare(String(b.get('created_at')||'')));
  for(const snapshot of candidates) {
    const claimToken=randomBytes(32).toString('hex');
    const outcome=await adminDb.runTransaction(async tx => {
      const ref=adminDb.collection(COLLECTION).doc(snapshot.id);
      const now=new Date();
      const current=await tx.get(ref);
      if(!current.exists) return null;
      const job=current.data() as JobRecord;
      if(job.status!=='pending') return null;
      const created=Date.parse(String(job.created_at||''));
      const goodId=validId(snapshot.id) && snapshot.id===`print-v1__${job.order_id}__${job.kind}`;
      const valid=goodId && job.protocol==='dfl.print.job.v1' && job.source==='site' &&
        (job.paper_mm==='58'||job.paper_mm==='80') && Number.isFinite(created) &&
        now.getTime()>=created && now.getTime()-created<=PRINT_JOB_MAX_AGE_MS;
      if(!valid){
        tx.update(ref,{status:'needs_review',reason:'stale_or_invalid',updated_at:now.toISOString()});
        return null;
      }
      const orderRef=adminDb.collection('Pedidos').doc(job.order_id!);
      const orderSnap=await tx.get(orderRef);
      if(!orderSnap.exists||printOrderBlocked(orderSnap.data()?.status)){
        tx.update(ref,{status:'needs_review',reason:'order_unavailable_or_blocked',updated_at:now.toISOString()});
        return null;
      }
      tx.update(ref,{status:'claimed',claim_hash:sha256(claimToken),claimed_at:now.toISOString(),updated_at:now.toISOString()});
      return {id:snapshot.id,claimToken,kind:job.kind!,paper:job.paper_mm!,order:{...orderSnap.data(),id:orderSnap.id}};
    });
    if(outcome) {
      // HTML is rendered only from authoritative stored order fields. The local renderer disables JavaScript.
      const rawHtml=buildThermalReceiptHtml(outcome.order,outcome.paper);
      const html=outcome.kind==='kitchen'
        ? rawHtml.replace(/(<body data-profile="(?:58|80)" data-ticket=")full("\s*>)/,'$1kitchen$2') : rawHtml;
      return {id:outcome.id,claimToken:outcome.claimToken,kind:outcome.kind,paperMm:outcome.paper,html};
    }
  }
  return null;
}

async function finishJob(id:string,claimToken:string,action:'ack'|'problem') {
  const ref=adminDb.collection(COLLECTION).doc(id);
  return adminDb.runTransaction(async tx => {
    const record=await tx.get(ref);
    if(!record.exists)return {ok:false,error:'NOT_FOUND'};
    const data=record.data() as JobRecord;
    if(!data.claim_hash||!match(data.claim_hash,sha256(claimToken)))return {ok:false,error:'CLAIM_INVALID'};
    if(data.status==='spool_submitted' && action==='ack') return {ok:true,duplicate:true};
    if(data.status!=='claimed')return {ok:false,error:'NOT_CLAIMED'};
    tx.update(ref,{
      status:action==='ack'?'spool_submitted':'needs_review',
      reason:action==='ack'?'windows_spooler_accepted':'local_print_uncertain',
      updated_at:new Date().toISOString(),
    });
    return {ok:true,duplicate:false};
  });
}

/** Machine-only endpoint. No browser token, no RLS bypass for clients, no CORS wildcard. */
export async function POST(request:NextRequest){
  if(!configured())return reply({ok:false,error:'PRINTING_OFF'},503);
  const provided=request.headers.get('x-dfl-print-agent-token')||'';
  if(!provided||!match(provided,process.env.DFL_PRINT_AGENT_TOKEN!))return reply({ok:false,error:'UNAUTHORIZED'},401);
  const len=Number(request.headers.get('content-length')||0);
  if(len>1400)return reply({ok:false,error:'BODY_TOO_LARGE'},413);
  let raw='';
  try{raw=await request.text();if(raw.length>1400)return reply({ok:false,error:'BODY_TOO_LARGE'},413);}catch{return reply({ok:false,error:'BAD_BODY'},400);}
  let body:Record<string,unknown>;
  try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('body');body=parsed;}catch{return reply({ok:false,error:'BAD_JSON'},400);}
  const action=body.action;
  try {
    if(action==='claim'){
      const job=await claimNextJob();
      return reply({ok:true,job});
    }
    if(action==='ack'||action==='problem'){
      if(!validId(body.jobId)||!validClaim(body.claimToken))return reply({ok:false,error:'INVALID_JOB'},400);
      const outcome=await finishJob(body.jobId,body.claimToken,action);
      return reply(outcome,outcome.ok?200:409);
    }
    return reply({ok:false,error:'UNKNOWN_ACTION'},400);
  } catch {
    // Never leak Firestore / order data or a token through an error.
    return reply({ok:false,error:'PRINT_SERVICE_UNAVAILABLE'},503);
  }
}
