import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { adminDb } from "@/lib/integration/server/admin";
import { isAdminEmail } from "@/lib/adminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = [
  "Pendente",
  "Em Produção",
  "Agendado",
  "Pronto",
  "Saiu para entrega",
  "Em rota",
] as const;

const HISTORY_STATUSES = [
  "Finalizado",
  "Cancelado",
] as const;

const ACTIVE_LIMIT_PER_STATUS = 40;
const HISTORY_LIMIT_PER_STATUS = 30;
const RESULT_LIMIT = 80;

type Raw = Record<string, unknown>;

function serialize(value: unknown): unknown {
  if (value == null) return value;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Raw).map(([key, item]) => [key, serialize(item)]),
    );
  }

  return null;
}

function millis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    try {
      return Number((value as { toMillis: () => number }).toMillis()) || 0;
    } catch {
      return 0;
    }
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function sortDocs(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
): FirebaseFirestore.QueryDocumentSnapshot[] {
  return [...docs].sort((a, b) => {
    const byDate = millis(b.data().data) - millis(a.data().data);
    return byDate || b.id.localeCompare(a.id);
  });
}

async function readStatusGroup(
  statuses: readonly string[],
  perStatusLimit: number,
) {
  const snapshots = await Promise.all(
    statuses.map((status) =>
      adminDb
        .collection("Pedidos")
        .where("status", "==", status)
        .limit(perStatusLimit)
        .get(),
    ),
  );

  const merged = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      merged.set(doc.id, doc);
    }
  }

  return sortDocs([...merged.values()]);
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
        { status: 401 },
      );
    }

    const decoded = await adminAuth.verifyIdToken(bearer, true);

    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const [activeDocs, historyDocs] = await Promise.all([
      readStatusGroup(ACTIVE_STATUSES, ACTIVE_LIMIT_PER_STATUS),
      readStatusGroup(HISTORY_STATUSES, HISTORY_LIMIT_PER_STATUS),
    ]);

    const active = activeDocs.slice(0, RESULT_LIMIT).map((doc) => ({
      id: doc.id,
      ...(serialize(doc.data()) as Raw),
    }));

    const history = historyDocs.slice(0, 40).map((doc) => ({
      id: doc.id,
      ...(serialize(doc.data()) as Raw),
    }));

    return NextResponse.json(
      {
        ok: true,
        orders: [...active, ...history],
        activeCount: active.length,
        historyCount: history.length,
        authorityVersion: 3,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[api/admin/orders]", error);

    return NextResponse.json(
      { ok: false, error: "ADMIN_ORDERS_FAILED" },
      { status: 500 },
    );
  }
}
