import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json({
    ok:true,
    service:"dfl-site",
    version:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||"local",
    integration:{
      outboundConfigured:Boolean(process.env.DFL_ENTREGAS_INTEGRATION_URL&&process.env.DFL_INTEGRATION_SIGNING_SECRET),
      relayEnabled:process.env.DFL_INTEGRATION_RELAY_ENABLED==="true",
    },
    checkedAt:new Date().toISOString(),
  },{headers:{"Cache-Control":"no-store"}});
}
