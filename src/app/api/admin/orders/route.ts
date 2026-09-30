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
const HISTORY_INDEX = "admin_order_history";
const HISTORY_INDEX_VERSION = 8;
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
function legacyDateMillis(value: unknown): number {
  const direct = millis(value);
  if (direct) return direct;
  if (typeof value !== "string") return 0;
  const raw=value.trim();
  const br=raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if(!br) return 0;
  const year=br[3] ? (br[3].length===2 ? 2000+Number(br[3]) : Number(br[3])) : new Date().getFullYear();
  const d=new Date(year,Number(br[2])-1,Number(br[1]),Number(br[4]||0),Number(br[5]||0));
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

function historyIdentity(data: Raw) {
  const customer=data.customerSnapshot && typeof data.customerSnapshot==="object"
    ? data.customerSnapshot as Raw : {};
  const name=String(data.userName ?? customer.name ?? data.nomeCliente ?? data.customerName ?? data.nome ?? "Cliente").trim() || "Cliente";
  const phone=String(data.userPhone ?? customer.phone ?? data.phone ?? "").trim();
  return {name,phone};
}

async function ensureHistoryIndex() {
  const metaRef=adminDb.collection(HISTORY_INDEX).doc("__meta__");
  const meta=await metaRef.get();
  if(meta.exists && Number(meta.data()?.version)===HISTORY_INDEX_VERSION && meta.data()?.complete===true) return;

  const seen=new Set<string>();
  let batch=adminDb.batch(), writes=0;
  const flush=async()=>{ if(!writes)return; await batch.commit(); batch=adminDb.batch(); writes=0; };

  for(const status of TERMINAL_STATUS_ALIASES){
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null=null;
    while(true){
      let q=adminDb.collection("Pedidos").where("status","==",status).orderBy(FieldPath.documentId()).limit(200);
      if(cursor) q=q.startAfter(cursor);
      const snap=await q.get();
      if(snap.empty) break;
      for(const doc of snap.docs){
        if(seen.has(doc.id)) continue;
        seen.add(doc.id);
        const data=doc.data() as Raw;
        const createdAtMs=legacyDateMillis(data.data) || legacyDateMillis(data.createdAt) || legacyDateMillis(data.statusUpdatedAt);
        const identity=historyIdentity(data);
        batch.set(adminDb.collection(HISTORY_INDEX).doc(doc.id),{
          orderId:doc.id,
          createdAtMs,
          status:looseStatus(data.status),
          customerName:identity.name,
          customerPhone:identity.phone,
          version:HISTORY_INDEX_VERSION,
        },{merge:true});
        writes++;
        if(writes>=400) await flush();
      }
      cursor=snap.docs.at(-1) ?? null;
      if(snap.size<200) break;
    }
  }
  await flush();
  await metaRef.set({version:HISTORY_INDEX_VERSION,complete:true,updatedAt:new Date().toISOString(),count:seen.size},{merge:true});
}

async function readHistory(cursor: string | null) {
  await ensureHistoryIndex();
  let q=adminDb.collection(HISTORY_INDEX)
    .where("version","==",HISTORY_INDEX_VERSION)
    .orderBy("createdAtMs","desc")
    .orderBy(FieldPath.documentId(),"desc")
    .limit(HISTORY_PAGE_SIZE+1);

  if(cursor){
    const snap=await adminDb.collection(HISTORY_INDEX).doc(cursor).get();
    if(snap.exists) q=q.startAfter(snap);
  }

  const idx=await q.get();
  const visible=idx.docs.filter(doc=>doc.id!=="__meta__");
  const page=visible.slice(0,HISTORY_PAGE_SIZE);
  const orderDocs=await Promise.all(page.map(doc=>adminDb.collection("Pedidos").doc(doc.id).get()));
  const orders=orderDocs.filter(doc=>doc.exists).map((doc,i)=>{
    const raw=doc.data() as Raw;
    const identity=historyIdentity(raw);
    return {
      id:doc.id,
      ...(serialize(raw) as Raw),
      userName:identity.name,
      userPhone:identity.phone || raw.userPhone,
      __historyCreatedAtMs:page[i]?.data().createdAtMs ?? 0,
    };
  });
  const hasMore=visible.length>HISTORY_PAGE_SIZE;
  return {
    orders,
    cursor:hasMore ? page.at(-1)?.id ?? null : null,
    hasMore,
    scanned:idx.size,
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
      return NextResponse.json({ok:true,mode:"search",orders,authorityVersion: 8},{headers:{"Cache-Control":"no-store, max-age=0"}});
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
          scanned: page.scanned,
          authorityVersion: 8,
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
        authorityVersion: 8,
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
