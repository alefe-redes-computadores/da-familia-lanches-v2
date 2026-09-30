import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { adminDb } from "@/lib/integration/server/admin";
import { isAdminEmail } from "@/lib/adminAuthorization";
import { INTEGRATION_COLLECTIONS } from "@/lib/integration/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!token) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return Boolean(decoded.email && isAdminEmail(decoded.email));
  } catch {
    return false;
  }
}

async function count(collection: string, status: string) {
  const snap = await adminDb
    .collection(collection)
    .where("status", "==", status)
    .count()
    .get();
  return Number(snap.data().count || 0);
}

async function countEligibleMessaging(status: "pending" | "processing") {
  const snap = await adminDb
    .collection("integration_notification_intents")
    .where("status", "==", status)
    .where("messaging_eligible", "==", true)
    .count()
    .get();
  return Number(snap.data().count || 0);
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      outboxPending,
      outboxFailed,
      outboxProcessing,
      outboxDead,
      msgPending,
      msgProcessing,
      msgFailed,
      msgEligiblePending,
      msgEligibleProcessing,
    ] = await Promise.all([
      count(INTEGRATION_COLLECTIONS.outbox, "pending"),
      count(INTEGRATION_COLLECTIONS.outbox, "failed"),
      count(INTEGRATION_COLLECTIONS.outbox, "processing"),
      count(INTEGRATION_COLLECTIONS.outbox, "dead_letter"),
      count("integration_notification_intents", "pending"),
      count("integration_notification_intents", "processing"),
      count("integration_notification_intents", "failed"),
      countEligibleMessaging("pending"),
      countEligibleMessaging("processing"),
    ]);

    const msgLegacyOrIneligible = Math.max(
      0,
      (msgPending + msgProcessing) - (msgEligiblePending + msgEligibleProcessing),
    );
    const backlog =
      outboxPending + outboxFailed + outboxProcessing +
      msgEligiblePending + msgEligibleProcessing;
    const quarantine = outboxDead + msgFailed;

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      integration: {
        state:
          backlog === 0 && quarantine === 0
            ? "healthy"
            : backlog > 0
              ? "attention"
              : "quarantine",
        backlog,
        quarantine,
        outbox: {
          pending: outboxPending,
          processing: outboxProcessing,
          failed: outboxFailed,
          deadLetter: outboxDead,
        },
        messaging: {
          pending: msgEligiblePending,
          processing: msgEligibleProcessing,
          rawPending: msgPending,
          rawProcessing: msgProcessing,
          legacyOrIneligible: msgLegacyOrIneligible,
          quarantined: msgFailed,
        },
      },
      note: "Diagnóstico sob demanda; não cria listener nem polling.",
    });
  } catch (error) {
    console.error("[admin/operation-health]", error);
    return NextResponse.json(
      { ok: false, error: "Não foi possível consultar a integração agora." },
      { status: 500 },
    );
  }
}
