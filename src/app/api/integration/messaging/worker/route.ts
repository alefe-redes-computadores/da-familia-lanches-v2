import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { collectMessagingProjections } from "@/lib/integration/server/messagingProjection";
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
    const body=await request.json().catch(()=>({})) as {limit?:unknown};
    const events=await collectMessagingProjections(Number(body.limit)||100);
    return NextResponse.json({ok:true,dry_run:true,count:events.length,events});
  }catch(error){
    const message=error instanceof Error?error.message:"Falha na projeção de mensageria.";
    console.error("[integration/messaging/worker]",message);
    return NextResponse.json({ok:false,error:message.slice(0,300)},{status:500});
  }
}
