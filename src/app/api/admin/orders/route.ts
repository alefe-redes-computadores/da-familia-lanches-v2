import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
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
  "Saiu para Entrega",
  "Saiu para entrega",
  "Em rota",
] as const;

const ACTIVE_LIMIT_PER_STATUS = 40;
const ACTIVE_RESULT_LIMIT = 100;
const HISTORY_PAGE_SIZE = 20;
const TERMINAL_STATUS_ALIASES = [
  "Finalizado", "Cancelado", "Concluído", "Concluido",
  "Concluída", "Concluida", "Finalizada", "Canceled", "Cancelled",
] as const;

type Raw = Record<string, unknown>;

function serialize(value: unknown): unknown {
  if (value == null) return value;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return value;

  if (Array.isArray(value)) return value.map(serialize);

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

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function looseStatus(value: unknown) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized.includes("cancel")) return "Cancelado";
  if (normalized.includes("final") || normalized.includes("conclu"))
    return "Finalizado";
  if (normalized.includes("agend")) return "Agendado";
  if (normalized.includes("pend")) return "Pendente";
  if (normalized.includes("produc") || normalized.includes("preparo"))
    return "Em Produção";
  if (normalized.includes("pronto")) return "Pronto";
  if (
    normalized.includes("saiu") ||
    normalized.includes("em rota") ||
    normalized.includes("a caminho")
  ) return "Saiu para Entrega";

  return String(value ?? "");
}

function sortDocs(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
) {
  return [...docs].sort((a, b) => {
    const ad = a.data();
    const bd = b.data();
    const av =
      millis(ad.statusUpdatedAt) ||
      millis(ad.data) ||
      millis(ad.createdAt);
    const bv =
      millis(bd.statusUpdatedAt) ||
      millis(bd.data) ||
      millis(bd.createdAt);

    return bv - av || b.id.localeCompare(a.id);
  });
}

async function authenticate(request: NextRequest) {
  const bearer =
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() || "";

  if (!bearer) return null;

  const decoded = await adminAuth.verifyIdToken(bearer, true);
  return isAdminEmail(decoded.email) ? decoded : null;
}

async function readActiveOrders() {
  const snapshots = await Promise.all(
    ACTIVE_STATUSES.map((status) =>
      adminDb
        .collection("Pedidos")
        .where("status", "==", status)
        .limit(ACTIVE_LIMIT_PER_STATUS)
        .get(),
    ),
  );

  const merged =
    new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) merged.set(doc.id, doc);
  }

  return sortDocs([...merged.values()])
    .slice(0, ACTIVE_RESULT_LIMIT)
    .map((doc) => ({
      id: doc.id,
      ...(serialize(doc.data()) as Raw),
    }));
}

/*
 * Histórico cronológico real pela data de criação do pedido.
 * `data` é gravado pelo checkout com serverTimestamp e representa quando o
 * pedido nasceu. statusUpdatedAt continua sendo apenas auditoria de transição.
 *
 * O cursor é o próprio documento da 20ª ocorrência terminal. Na página
 * seguinte recuperamos esse snapshot e usamos startAfter(snapshot), preservando
 * inclusive documentos legados com representações heterogêneas de `data`.
 */
type HistoryCursor = { offset: number };

function terminalMillis(data: Raw) {
  return millis(data.statusUpdatedAt) || millis(data.data) || millis(data.createdAt);
}
function encodeHistoryCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset } satisfies HistoryCursor), "utf8").toString("base64url");
}
function decodeHistoryCursor(value: string | null): number {
  if (!value) return 0;
  try {
    const parsed=JSON.parse(Buffer.from(value,"base64url").toString("utf8")) as HistoryCursor;
    return Number.isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
  } catch { return 0; }
}

/* HISTORY V12: snapshot on-demand. Sem listener, backfill ou escrita. */
const HISTORY_SNAPSHOT_LIMIT = 500;
async function readHistorySnapshot() {
  const snap=await adminDb.collection("Pedidos").limit(HISTORY_SNAPSHOT_LIMIT).get();
  const terminal=snap.docs.filter((doc)=>{
    const status=looseStatus(doc.data().status);
    return status==="Finalizado" || status==="Cancelado";
  });
  terminal.sort((a,b)=>{
    const av=terminalMillis(a.data() as Raw), bv=terminalMillis(b.data() as Raw);
    return bv-av || b.id.localeCompare(a.id);
  });
  return {
    orders:terminal.map((doc)=>({id:doc.id,...(serialize(doc.data()) as Raw)})),
    scanned:snap.size,
    truncated:snap.size>=HISTORY_SNAPSHOT_LIMIT,
  };
}
async function readHistory(cursorValue: string | null) {
  const snapshot=await readHistorySnapshot();
  const offset=decodeHistoryCursor(cursorValue);
  const orders=snapshot.orders.slice(offset,offset+HISTORY_PAGE_SIZE);
  const nextOffset=offset+orders.length;
  const hasMore=nextOffset<snapshot.orders.length;
  return {
    orders,
    historyCatalog:offset===0?snapshot.orders:undefined,
    cursor:hasMore?encodeHistoryCursor(nextOffset):null,
    hasMore,
    scanned:snapshot.scanned,
    total:snapshot.orders.length,
    truncated:snapshot.truncated,
  };
}
async function searchHistoryIdentifier(term: string) {
  const clean = term.trim(); if (!clean) return [];
  const merged = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const direct = await adminDb.collection("Pedidos").doc(clean).get();
  if (direct.exists && ["Finalizado","Cancelado"].includes(looseStatus(direct.data()?.status)))
    merged.set(direct.id, direct as FirebaseFirestore.QueryDocumentSnapshot);
  const candidates=[...new Set([clean,clean.replace(/\D/g,"")].filter(Boolean))];
  const queries: Promise<FirebaseFirestore.QuerySnapshot>[]=[];
  for(const field of ["userPhone","phone"] as const) for(const phone of candidates)
    queries.push(adminDb.collection("Pedidos").where(field,"==",phone).limit(20).get());
  for(const snap of await Promise.all(queries)) for(const doc of snap.docs)
    if(["Finalizado","Cancelado"].includes(looseStatus(doc.data().status))) merged.set(doc.id,doc);
  return sortDocs([...merged.values()]).slice(0,20).map(doc=>({id:doc.id,...(serialize(doc.data()) as Raw)}));
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await authenticate(request);

    if (!decoded) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    const requestedMode=request.nextUrl.searchParams.get("mode");
    const mode=requestedMode==="history"||requestedMode==="search"?requestedMode:"bootstrap";
    if(mode==="search"){
      const orders=await searchHistoryIdentifier(request.nextUrl.searchParams.get("q")?.trim()||"");
      return NextResponse.json({ok:true,mode:"search",orders,authorityVersion: 12},{headers:{"Cache-Control":"no-store, max-age=0"}});
    }

    if (mode === "history") {
      const cursor =
        request.nextUrl.searchParams.get("cursor")?.trim() || null;

      const page = await readHistory(cursor);

      return NextResponse.json(
        {
          ok: true,
          mode: "history",
          orders: page.orders,
          historyCursor: page.cursor,
          historyHasMore: page.hasMore,
          historyCatalog: page.historyCatalog,
          historyTotal: page.total,
          historyTruncated: page.truncated,
          scanned: page.scanned,
          authorityVersion: 12,
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    const [active, historyPage] = await Promise.all([
      readActiveOrders(),
      readHistory(null),
    ]);

    return NextResponse.json(
      {
        ok: true,
        mode: "bootstrap",
        orders: [...active, ...historyPage.orders],
        activeCount: active.length,
        historyCount: historyPage.orders.length,
        historyCursor: historyPage.cursor,
        historyHasMore: historyPage.hasMore,
        historyCatalog: historyPage.historyCatalog,
        historyTotal: historyPage.total,
        historyTruncated: historyPage.truncated,
        authorityVersion: 12,
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
