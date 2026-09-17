import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  claimMessagingProjections,
  settleMessagingProjections,
} from "@/lib/integration/server/messagingProjection";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(request:NextRequest){
  const expected=(process.env.DFL_MESSAGING_BRIDGE_SECRET||process.env.DFL_REVERSE_WORKER_SECRET||process.env.CRON_SECRET||"").trim();
  const h=request.headers.get("authorization")||"";
  const received=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(!expected||!received)return false;
  const a=Buffer.from(expected),b=Buffer.from(received);
  return a.length===b.length&&timingSafeEqual(a,b);
}

export async function POST(request:NextRequest){
  if(!authorized(request)) return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const body=await request.json().catch(()=>({})) as {
      action?:unknown; limit?:unknown; worker_id?:unknown;
      results?:Array<{intent_id?:unknown;ok?:unknown;error?:unknown}>;
    };
    const action=String(body.action||"claim");
    if(action==="settle"){
      const workerId=String(body.worker_id||"").trim();
      if(!workerId) return NextResponse.json({ok:false,error:"worker_id obrigatório"},{status:400});
      const results=Array.isArray(body.results)?body.results.map(r=>({
        intent_id:String(r.intent_id||"").trim(),
        ok:r.ok===true,
        error:String(r.error||""),
      })).filter(r=>r.intent_id):[];
      const settled=await settleMessagingProjections(workerId,results);
      return NextResponse.json({ok:true,...settled});
    }
    if(action!=="claim") return NextResponse.json({ok:false,error:"action inválida"},{status:400});
    const claimed=await claimMessagingProjections(Number(body.limit)||20);
    return NextResponse.json({ok:true,count:claimed.events.length,...claimed});
  }catch(error){
    const message=error instanceof Error?error.message:"Falha no worker de mensageria.";
    console.error("[integration/messaging/worker]",message);
    return NextResponse.json({ok:false,error:message.slice(0,300)},{status:500});
  }
}
