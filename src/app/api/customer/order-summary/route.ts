import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/integration/server/admin";
import {
  errorCode,
  finishRouteTrace,
  startRouteTrace,
} from "@/lib/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initializedInProcess = new Set<string>();
const inflight = new Map<string, Promise<void>>();

async function ensureSummary(uid: string) {
  if (initializedInProcess.has(uid)) return;

  const existing = inflight.get(uid);
  if (existing) return existing;

  const work = (async () => {
    const ref = adminDb.doc(`Usuarios/${uid}/Loyalty/state`);
    const current = await ref.get();
    const data = current.data() ?? {};

    if (data.initialized === true && Number(data.version) >= 2) {
      initializedInProcess.add(uid);
      return;
    }

    const orders = adminDb.collection("Pedidos").where("userId", "==", uid);

    const [total, completed, cancelled] = await Promise.all([
      orders.count().get(),
      orders.where("status", "==", "Finalizado").count().get(),
      orders.where("status", "==", "Cancelado").count().get(),
    ]);

    /*
     * Só existe escrita quando realmente precisamos inicializar/migrar
     * o resumo. Chamadas posteriores não atualizam timestamps à toa.
     */
    await ref.set(
      {
        version: 2,
        initialized: true,
        totalOrders: total.data().count,
        completedOrders: completed.data().count,
        cancelledOrders: cancelled.data().count,
        backfilledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    initializedInProcess.add(uid);
  })().finally(() => {
    inflight.delete(uid);
  });

  inflight.set(uid, work);
  return work;
}

export async function GET(request: NextRequest) {
  const trace = startRouteTrace("customer.order-summary");

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

    /*
     * checkRevoked=false:
     * este endpoint é somente leitura/inicialização de resumo.
     * A validação criptográfica do ID token permanece; evitamos a
     * verificação remota de revogação em toda abertura de carrinho.
     */
    const decoded = await adminAuth.verifyIdToken(bearer, false);

    await ensureSummary(decoded.uid);

    finishRouteTrace(trace, "ok", {
      initialized: true,
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "x-dfl-trace-id": trace.id,
        },
      },
    );
  } catch (error) {
    finishRouteTrace(trace, "error", {
      errorCode: errorCode(error),
    });

    return NextResponse.json(
      { ok: false, error: "SUMMARY_FAILED" },
      {
        status: 500,
        headers: {
          "x-dfl-trace-id": trace.id,
        },
      },
    );
  }
}
