import { NextRequest,NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import { runAnalyticsBackfill } from "@/lib/analytics/server/projector";
import { safeSecretEquals } from "@/lib/integration/server/signature";
export const runtime="nodejs"; export const dynamic="force-dynamic";
function auth(r:NextRequest){const s=process.env.DFL_INTEGRATION_WORKER_SECRET||process.env.DFL_INTEGRATION_SECRET||"";const x=r.headers.get("x-dfl-worker-secret")||r.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";return Boolean(s&&x&&safeSecretEquals(s,x))}
async function cp(){const s=await adminDb.collection("analytics_projector_checkpoints").doc("site_orders_v3").get();return s.exists?s.data():null}
export async function GET(r:NextRequest){if(!auth(r))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});const recent=await adminDb.collection("analytics_daily_v2").orderBy("__name__","desc").limit(31).get();return NextResponse.json({ok:true,checkpoint:await cp(),days:recent.docs.map(d=>({dateKey:d.id,...d.data()}))})}
export async function POST(r:NextRequest){if(!auth(r))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});const b=await r.json().catch(()=>({})) as {action?:string;batches?:number};if(b.action!=="backfill")return NextResponse.json({ok:false,error:"unsupported_action"},{status:400});let result=null;const n=Math.max(1,Math.min(20,Number(b.batches)||1));for(let i=0;i<n;i++){result=await runAnalyticsBackfill(80);if(result.complete)break}return NextResponse.json({ok:true,result,checkpoint:await cp()})}
