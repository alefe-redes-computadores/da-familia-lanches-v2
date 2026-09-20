import { NextRequest, NextResponse } from "next/server";
import { getApp } from "firebase-admin/app";
import { adminDb } from "@/lib/integration/server/admin";
import { INTEGRATION_COLLECTIONS } from "@/lib/integration/firestore";
import { safeSecretEquals } from "@/lib/integration/server/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TARGET_SUFFIX = "W00LYSZA";
const WEB_PROJECT_ID = "da-familia-lanches";
const RECENT_ORDER_LIMIT = 120;
const MAX_ORDER_PAGES = 4;

function targetSuffix(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("suffix") || DEFAULT_TARGET_SUFFIX;
  const normalized = raw.replace(/^#/, "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(normalized)) {
    throw new Error("Sufixo inválido.");
  }
  return normalized;
}

function authorized(req: NextRequest) {
  const expected =
    process.env.DFL_INTEGRATION_WORKER_SECRET ||
    process.env.CRON_SECRET ||
    "";
  const bearer =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  return Boolean(expected) && safeSecretEquals(bearer, expected);
}

function scalar(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return value;
  return null;
}

function safeOutbox(data: Record<string, unknown>) {
  return {
    event_id: scalar(data.event_id),
    event_type: scalar(data.event_type),
    status: scalar(data.status),
    attempts: scalar(data.attempts),
    occurred_at: scalar(data.occurred_at),
    created_at: scalar(data.created_at),
    updated_at: scalar(data.updated_at),
    processed_at: scalar(data.processed_at),
    next_attempt_at: scalar(data.next_attempt_at),
    locked_at: scalar(data.locked_at),
    locked_by: scalar(data.locked_by),
    last_error: scalar(data.last_error),
  };
}

function safeIntent(id: string, data: Record<string, unknown>) {
  return {
    document_id: id,
    intent_id: scalar(data.intent_id),
    intent_type: scalar(data.intent_type),
    source_event_id: scalar(data.source_event_id),
    source_event_type: scalar(data.source_event_type),
    order_id: scalar(data.order_id),
    delivery_id: scalar(data.delivery_id),
    status: scalar(data.status),
    messaging_eligible: scalar(data.messaging_eligible),
    attempts: scalar(data.attempts),
    created_at: scalar(data.created_at),
    updated_at: scalar(data.updated_at),
    locked_at: scalar(data.locked_at),
    last_error: scalar(data.last_error),
    messaging_queued_at: scalar(data.messaging_queued_at),
  };
}

async function findRecentOrderBySuffix(suffix: string) {
  // Diagnóstico paginado e rigidamente limitado.
  // Para assim que encontra o sufixo e nunca percorre o histórico inteiro.
  const matches: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let scanned = 0;
  let pages = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (pages < MAX_ORDER_PAGES && matches.length === 0) {
    let query = adminDb
      .collection("Pedidos")
      .orderBy("data", "desc")
      .limit(RECENT_ORDER_LIMIT);

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const page = await query.get();
    pages += 1;
    scanned += page.size;

    for (const doc of page.docs) {
      if (doc.id.toUpperCase().endsWith(suffix)) {
        matches.push(doc);
      }
    }

    if (page.empty || page.size < RECENT_ORDER_LIMIT) {
      break;
    }

    cursor = page.docs[page.docs.length - 1];
  }

  return {
    scanned,
    limit: RECENT_ORDER_LIMIT * MAX_ORDER_PAGES,
    pages,
    matches,
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const appOptionProjectId = getApp().options.projectId || null;
    const rawServiceAccount =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || "";
    let credentialProjectId: string | null = null;
    if (rawServiceAccount) {
      try {
        const parsed = JSON.parse(rawServiceAccount) as { project_id?: unknown };
        credentialProjectId =
          typeof parsed.project_id === "string" && parsed.project_id.trim()
            ? parsed.project_id.trim()
            : null;
      } catch {
        credentialProjectId = null;
      }
    }
    const adminProjectId = credentialProjectId || appOptionProjectId;
    const suffix = targetSuffix(req);
    const located = await findRecentOrderBySuffix(suffix);

    if (located.matches.length !== 1) {
      return NextResponse.json(
        {
          ok: false,
          read_only: true,
          firebase_projects: {
            web_project: WEB_PROJECT_ID,
            admin_project: adminProjectId,
            credential_project: credentialProjectId,
            app_option_project: appOptionProjectId,
            same_project: adminProjectId === WEB_PROJECT_ID,
          },
          target_suffix: suffix,
          scan_scope: "recent_orders_only",
          scan_limit: located.limit,
          scanned_orders: located.scanned,
          matches: located.matches.map((doc) => ({
            order_id: doc.id,
            suffix: doc.id.slice(-8).toUpperCase(),
          })),
          error:
            located.matches.length === 0
              ? "Pedido alvo não encontrado na janela recente limitada."
              : "Mais de um pedido corresponde ao sufixo.",
        },
        { status: located.matches.length === 0 ? 404 : 409 },
      );
    }

    const orderDoc = located.matches[0];
    const orderId = orderDoc.id;
    const order = orderDoc.data() as Record<string, unknown>;
    const eventId =
      `evt-v1__order.created__${encodeURIComponent(orderId.trim())}__created`;

    const outboxCollection = adminDb.collection(INTEGRATION_COLLECTIONS.outbox);
    const directOutbox = await outboxCollection.doc(eventId).get();
    let outbox = directOutbox.exists ? directOutbox : null;

    if (!outbox) {
      const fallback = await outboxCollection
        .where("event_id", "==", eventId)
        .limit(2)
        .get();

      if (fallback.size > 1) {
        return NextResponse.json(
          {
            ok: false,
            read_only: true,
            firebase_projects: {
              web_project: WEB_PROJECT_ID,
              admin_project: adminProjectId,
              credential_project: credentialProjectId,
              app_option_project: appOptionProjectId,
              same_project: adminProjectId === WEB_PROJECT_ID,
            },
            order_id: orderId,
            event_id: eventId,
            error: "event_id duplicado na outbox.",
          },
          { status: 409 },
        );
      }

      outbox = fallback.empty ? null : fallback.docs[0];
    }

    const intentsByOrder = await adminDb
      .collection("integration_notification_intents")
      .where("order_id", "==", orderId)
      .limit(50)
      .get();

    const intentsBySource = await adminDb
      .collection("integration_notification_intents")
      .where("source_event_id", "==", eventId)
      .limit(50)
      .get();

    const merged = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot
    >();

    for (const doc of [...intentsByOrder.docs, ...intentsBySource.docs]) {
      merged.set(doc.id, doc);
    }

    return NextResponse.json({
      ok: true,
      read_only: true,
      firebase_projects: {
        web_project: WEB_PROJECT_ID,
        admin_project: adminProjectId,
        credential_project: credentialProjectId,
        app_option_project: appOptionProjectId,
        same_project: adminProjectId === WEB_PROJECT_ID,
      },
      target_suffix: suffix,
      scan_scope: "recent_orders_only",
      scan_limit: located.limit,
      scanned_orders: located.scanned,
      order: {
        id: orderId,
        reference: `#${orderId.slice(-8).toUpperCase()}`,
        status: scalar(order.status),
        created_at: scalar(order.created_at ?? order.createdAt),
        updated_at: scalar(order.updated_at ?? order.updatedAt),
      },
      order_created_event: {
        event_id: eventId,
        outbox_found: Boolean(outbox),
        outbox: outbox
          ? safeOutbox(outbox.data() as Record<string, unknown>)
          : null,
      },
      messaging_intents: [...merged.values()].map((doc) =>
        safeIntent(doc.id, doc.data() as Record<string, unknown>),
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no diagnóstico.";
    console.error("[integration/diagnostic/order-trace]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
