import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import { DEFAULT_VISUAL_CAMPAIGNS, normalizeCampaignList } from "@/lib/visualCampaigns";

export const runtime = "nodejs";
const read = unstable_cache(async () => {
  const snap = await adminDb.doc("settings/visualCampaigns").get();
  return snap.exists ? normalizeCampaignList(snap.data()?.items) : DEFAULT_VISUAL_CAMPAIGNS;
}, ["dfl-visual-campaigns-v1"], { revalidate: 120, tags: ["dfl-visual-campaigns"] });

export async function GET() {
  try {
    const items = await read();
    return NextResponse.json({items}, {headers:{"Cache-Control":"public, s-maxage=120, stale-while-revalidate=180"}});
  } catch (error) {
    console.error("[visual-campaigns] read failed", error);
    // Falha aberta somente para identidade visual. Nunca altera pedidos.
    return NextResponse.json({items:DEFAULT_VISUAL_CAMPAIGNS,degraded:true}, {headers:{"Cache-Control":"no-store"}});
  }
}
