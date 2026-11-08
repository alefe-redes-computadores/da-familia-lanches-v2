import { NextRequest, NextResponse } from "next/server";
import { drainIntegrationOutbox } from "@/lib/integration/server/relay";
import { safeSecretEquals } from "@/lib/integration/server/signature";
import { runAnalyticsBackfill } from "@/lib/analytics/server/projector";
import { retryPendingAdminPushes } from "@/lib/adminPush/server";
import { drainAutoAcceptances } from "@/lib/tracking/automaticAcceptance";
export const runtime="nodejs"; export const dynamic="force-dynamic";
function authorized(req:NextRequest){const secret=process.env.DFL_INTEGRATION_WORKER_SECRET||process.env.CRON_SECRET||""; const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||null; return Boolean(secret)&&safeSecretEquals(bearer,secret);}
async function run(req:NextRequest){if(!authorized(req))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401}); try{const relay=await drainIntegrationOutbox(); const autoAccept=await drainAutoAcceptances(5).catch(()=>({enabled:true,claimed:0,acknowledged:0,deferred:1,blocked:0})); const analyticsMode=req.nextUrl.searchParams.get("analytics"); const analytics=analyticsMode==="backfill"?await runAnalyticsBackfill(80):{complete:false,processed:0,skipped:true}; const adminPush=await retryPendingAdminPushes(5).catch(error=>{console.error("[integration/worker] push-retry isolado",error);return {scanned:0,attempted:0,recovered:0,skipped:0,failed:1};}); console.log("[integration/worker]",{claimed:relay.claimed,sent:relay.sent,failed:relay.failed,autoAccept,analytics,adminPush}); return NextResponse.json({ok:relay.failed===0&&adminPush.failed===0,relay,autoAccept,analytics,adminPush},{status:relay.failed||adminPush.failed?207:200});}catch(e){const message=e instanceof Error?e.message:"Worker failed"; console.error("[integration/worker]",message); return NextResponse.json({ok:false,error:message},{status:500});}}
export const GET=run; export const POST=run;
