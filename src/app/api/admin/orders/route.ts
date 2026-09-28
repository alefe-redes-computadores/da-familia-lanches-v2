import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { isAdminEmail } from "@/lib/adminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(value: unknown): unknown {
  if (value == null) return value;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return value;

  if (Array.isArray(value)) return value.map(serialize);

  if (typeof value === "object") {
    const candidate = value as { toDate?: () => Date };

    if (typeof candidate.toDate === "function") {
      return candidate.toDate().toISOString();
    }

    const result: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = serialize(child);
    }

    return result;
  }

  return String(value);
}

export async function GET(request: NextRequest) {
  try {
    const bearer =
      request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim() || "";

    if (!bearer) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(bearer, false);

    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_REQUIRED" },
        { status: 403 }
      );
    }

    const snapshot = await adminDb
      .collection("Pedidos")
      .orderBy("data", "desc")
      .limit(40)
      .get();

    const orders = snapshot.docs.map((document) => ({
      id: document.id,
      ...(serialize(document.data()) as Record<string, unknown>),
    }));

    return NextResponse.json(
      { ok: true, orders, count: orders.length },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[admin/orders] failed", error);

    return NextResponse.json(
      { ok: false, error: "ADMIN_ORDERS_FAILED" },
      { status: 500 }
    );
  }
}
