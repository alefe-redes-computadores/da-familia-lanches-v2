import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { adminDb } from "@/lib/integration/server/admin";
import { isAdminEmail } from "@/lib/adminAuthorization";
import { DEFAULT_VISUAL_CAMPAIGNS, normalizeCampaignList } from "@/lib/visualCampaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticate(request:NextRequest) {
  const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim() || "";
  if(!bearer)return null;
  const claims=await adminAuth.verifyIdToken(bearer,true);
  return isAdminEmail(claims.email) ? claims : null;
}

export async function GET(request:NextRequest) {
  try {
    if(!await authenticate(request))return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401});
    const snap=await adminDb.doc("settings/visualCampaigns").get();
    const items=snap.exists?normalizeCampaignList(snap.data()?.items):DEFAULT_VISUAL_CAMPAIGNS;
    return NextResponse.json({ok:true,items,configured:snap.exists},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("[admin/visual-campaigns] read",error);return NextResponse.json({ok:false,error:"CAMPAIGN_READ_FAILED"},{status:500});}
}
export async function POST(request:NextRequest) {
  try {
    const user=await authenticate(request);
    if(!user)return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401});
    const length=Number(request.headers.get("content-length")||0);
    if(length>85000)return NextResponse.json({ok:false,error:"CAMPAIGN_PAYLOAD_TOO_LARGE"},{status:413});
    const data=await request.json() as {items?:unknown};
    const items=normalizeCampaignList(data?.items);
    // Apenas campos permitidos, sem CSS/JS arbitrário e com contraste verificado.
    await adminDb.doc("settings/visualCampaigns").set({schemaVersion:1,items,updatedBy:user.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    revalidateTag("dfl-visual-campaigns","max");
    return NextResponse.json({ok:true,count:items.length},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const message=error instanceof Error?error.message:"";
    if(message.startsWith("CAMPAIGN_"))return NextResponse.json({ok:false,error:message},{status:400});
    console.error("[admin/visual-campaigns] save",error);
    return NextResponse.json({ok:false,error:"CAMPAIGN_SAVE_FAILED"},{status:500});
  }
}
