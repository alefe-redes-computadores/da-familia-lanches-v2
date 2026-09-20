import { NextRequest, NextResponse } from "next/server";
import { drainIntegrationOutbox } from "@/lib/integration/server/relay";
import { safeSecretEquals } from "@/lib/integration/server/signature";
import { runAnalyticsBackfill } from "@/lib/analytics/server/projector";
export const runtime="nodejs"; export const dynamic="force-dynamic";
function authorized(req:NextRequest){const secret=process.env.DFL_INTEGRATION_WORKER_SECRET||process.env.CRON_SECRET||""; const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||null; return Boolean(secret)&&safeSecretEquals(bearer,secret);}
async function run(req:NextRequest){if(!authorized(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401}); try{const relay=await drainIntegrationOutbox(); const analyticsMode=req.nextUrl.searchParams.get("analytics"); const analytics=analyticsMode==="backfill"?await runAnalyticsBackfill(80):{complete:false,processed:0,skipped:true}; console.log("[integration/worker]",{claimed:relay.claimed,sent:relay.sent,failed:relay.failed,analytics}); return NextResponse.json({ok:relay.failed===0,relay,analytics},{status:relay.failed?207:200});}catch(e){const message=e instanceof Error?e.message:"Worker failed"; console.error("[integration/worker]",message); return NextResponse.json({ok:false,error:message},{status:500});}}
export const GET=run; export const POST=run;
