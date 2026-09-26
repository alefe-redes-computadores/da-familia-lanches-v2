import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import { errorCode, finishRouteTrace, startRouteTrace } from "@/lib/server/observability";

export const runtime = "nodejs";

const readPromotions = unstable_cache(async () => {
  const trace = startRouteTrace("public.promotions.refresh");
  const snapshot = await adminDb.doc("settings/publicPromotions").get();
  const raw = snapshot.exists && Array.isArray(snapshot.data()?.items)
    ? snapshot.data()!.items as Array<Record<string, unknown>>
    : [];

  const items = raw.map((item) => {
    const millis = (value: unknown) => {
      if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
        return Number((value as { toMillis: () => number }).toMillis());
      }
      return typeof value === "number" ? value : null;
    };
    return { ...item, startsAt: millis(item.startsAt), expiresAt: millis(item.expiresAt) };
  });

  finishRouteTrace(trace, "ok", { firestoreDocuments: snapshot.exists ? 1 : 0, promotions: items.length });
  return { items, generatedAt: new Date().toISOString() };
}, ["public-promotions-v2"], { revalidate: 600, tags: ["public-promotions"] });

export async function GET() {
  const trace = startRouteTrace("public.promotions.request");
  try {
    const payload = await readPromotions();
    finishRouteTrace(trace, "ok", { cachePolicy: "600s" });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        "x-dfl-trace-id": trace.id,
      },
    });
  } catch (error) {
    finishRouteTrace(trace, "error", { errorCode: errorCode(error) });
    return NextResponse.json(
      { items: [], generatedAt: null, degraded: true },
      { status: 503, headers: { "Cache-Control": "no-store", "x-dfl-trace-id": trace.id } },
    );
  }
}
