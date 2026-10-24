import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { adminApp, adminDb } from "@/lib/integration/server/admin";
import {
  ADMIN_PUSH_LEASE_MS, ADMIN_PUSH_MAX_AGE_MS, MAX_ADMIN_PUSH_ATTEMPTS,
  mayClaimAdminPush, retryDelayMs,
  type AdminPushDispatchState,
} from "./retryPolicy";

const SUBSCRIPTIONS = "AdminPushSubscriptions";
const DISPATCHES = "AdminPushDispatches";
// Preserva o identificador do protocolo v1 para compatibilidade com registros
// existentes; o campo retryProtocol sinaliza a recuperação v2 por token.
const TOKEN_LIMIT = 50;
const REQUEST_RETRIES = 3;
const REQUEST_RETRY_MS = 350;

type AdminNewOrderPush = {
  orderId: string;
  customerName: string;
  total: number;
  deliveryMode: "delivery" | "pickup";
};
type DispatchData = AdminPushDispatchState & {
  orderId?: string;
  customerName?: string;
  total?: number;
  deliveryMode?: string;
  successfulTokenHashes?: string[];
  invalidTokenHashes?: string[];
  leaseId?: string;
  createdAt?: { toMillis?: () => number };
};
const clean = (v: unknown) => String(v ?? "").trim();
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const dispatchId = (orderId: string) => hash(`admin-new-order-v1:${orderId}`);
const tokenHash = (token: string) => hash(`admin-push-token:${token}`);
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number.isFinite(n) ? n : 0);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const invalidTokenCode = (code: string) => code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");

async function markAttempt(
  ref: DocumentReference,
  leaseId: string,
  patch: Record<string, unknown>,
) {
  // Protege contra um worker atrasado sobrescrevendo o resultado do lease mais recente.
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.leaseId !== leaseId) return false;
    tx.set(ref, { ...patch, leaseId:null, leaseUntilMs:0, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    return true;
  });
}

async function claimAttempt(input: AdminNewOrderPush) {
  const now = Date.now();
  const ref = adminDb.collection(DISPATCHES).doc(dispatchId(input.orderId));
  const leaseId = randomUUID();
  const claim = await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = (snapshot.data() || {}) as DispatchData;
    const decision = mayClaimAdminPush(snapshot.exists ? current : null, now);
    if (!decision.claim) {
      if (decision.reason === "expired" && current.status !== "dead_letter") {
        tx.set(ref, { status:"dead_letter", leaseId:null, leaseUntilMs:0, lastError:"push_retry_window_exceeded", updatedAt:FieldValue.serverTimestamp() }, { merge:true });
      }
      return { claimed:false, reason:decision.reason, previous:current };
    }
    const attemptCount = (Number(current.attemptCount) || 0) + 1;
    tx.set(ref, {
      protocol:"admin-new-order-v1", retryProtocol:"token-level-v2", orderId:input.orderId,
      customerName:input.customerName.slice(0,120), total:input.total,
      deliveryMode:input.deliveryMode,
      firstSeenAtMs:Number(current.firstSeenAtMs) || now,
      attemptCount, status:"processing", leaseId, leaseUntilMs:now + ADMIN_PUSH_LEASE_MS,
      nextAttemptAtMs:0, updatedAt:FieldValue.serverTimestamp(),
      ...(snapshot.exists ? {} : { createdAt:FieldValue.serverTimestamp() }),
    }, { merge:true });
    return { claimed:true, reason:decision.reason, previous:current, attemptCount };
  });
  return { ref, leaseId, now, ...claim };
}

export async function sendAdminNewOrderPush(input: AdminNewOrderPush) {
  const orderId = clean(input.orderId);
  if (!orderId) return { attempted:false, sent:0, failed:0, reason:"missing_order_id" };
  const canonical: AdminNewOrderPush = {
    orderId, customerName:clean(input.customerName).slice(0,120) || "Cliente",
    total:Number.isFinite(input.total) ? input.total : 0,
    deliveryMode:input.deliveryMode === "pickup" ? "pickup" : "delivery",
  };
  const claim = await claimAttempt(canonical);
  if (!claim.claimed) return { attempted:false, sent:0, failed:0, reason:claim.reason };
  const { ref, leaseId, now } = claim;
  const attemptCount = claim.attemptCount || 1;
  const previous = claim.previous;
  const successful = new Set((previous.successfulTokenHashes || []).filter((v):v is string => typeof v === "string"));
  const invalid = new Set((previous.invalidTokenHashes || []).filter((v):v is string => typeof v === "string"));
  const reschedule = async (reason: string, noSubscribers = false) => {
    const delay = retryDelayMs(attemptCount, noSubscribers);
    const terminal = attemptCount >= MAX_ADMIN_PUSH_ATTEMPTS ||
      now - (Number(previous.firstSeenAtMs) || now) + delay > ADMIN_PUSH_MAX_AGE_MS;
    const next = terminal ? "dead_letter" : "retry";
    await markAttempt(ref, leaseId, {
      status:next, nextAttemptAtMs:terminal ? 0 : Date.now() + delay,
      successfulTokenHashes:[...successful], invalidTokenHashes:[...invalid],
      lastError:reason.slice(0,180), lastAttemptAtMs:Date.now(),
    });
    return { attempted:true, sent:0, failed:0, reason:next };
  };

  try {
    const snapshot = await adminDb.collection(SUBSCRIPTIONS).where("enabled", "==", true).limit(TOKEN_LIMIT).get();
    const subscriptions = snapshot.docs
      .map((doc) => ({ ref:doc.ref, token:clean(doc.data().token) }))
      .filter((item) => item.token.length >= 20)
      .map((item) => ({ ...item, hash:tokenHash(item.token) }));
    const pending = subscriptions.filter((item) => !successful.has(item.hash) && !invalid.has(item.hash));

    if (!subscriptions.length) return reschedule("no_enabled_subscribers", true);
    if (!pending.length) {
      // Todas as inscrições atuais já tiveram resultado terminal. Novos tokens
      // terão sua própria inscrição e poderão participar de um retry futuro;
      // nunca reenviar para os que já tiveram confirmação de aceitação.
      const anySuccess = successful.size > 0;
      if (!anySuccess) return reschedule("no_deliverable_subscribers", true);
      await markAttempt(ref, leaseId, { status:"sent", successCount:successful.size, invalidTokenCount:invalid.size, processedAt:FieldValue.serverTimestamp(), lastError:null });
      return { attempted:true, sent:0, failed:0, reason:"already_accepted" };
    }

    const message: MulticastMessage = {
      tokens:pending.map((item) => item.token),
      data:{
        type:"admin.new_order", title:"Novo pedido recebido",
        body:`${canonical.customerName} · ${money(canonical.total)} · ${canonical.deliveryMode === "pickup" ? "Retirada" : "Entrega"}`,
        orderId, tag:`new-order-${orderId}`,
        url:`/admin?stage=cozinha&order=${encodeURIComponent(orderId)}`,
      },
      webpush:{headers:{Urgency:"high",TTL:"3600"},fcmOptions:{link:"https://admin.dafamilialanches.com.br/"}},
    };
    let response: Awaited<ReturnType<ReturnType<typeof getMessaging>["sendEachForMulticast"]>> | null = null;
    let lastError: unknown;
    for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt++) {
      try { response = await getMessaging(adminApp).sendEachForMulticast(message); break; }
      catch (error) { lastError = error; if (attempt < REQUEST_RETRIES) await wait(REQUEST_RETRY_MS * attempt); }
    }
    if (!response) throw lastError || new Error("ADMIN_PUSH_FCM_UNAVAILABLE");
    const invalidRefs: DocumentReference[] = [];
    for (let index=0; index<pending.length; index++) {
      const item = response.responses[index];
      const target = pending[index];
      if (item?.success) successful.add(target.hash);
      else if (invalidTokenCode(clean(item?.error?.code))) {
        invalid.add(target.hash);
        invalidRefs.push(target.ref);
      }
    }
    const pendingTransient = pending.filter((item) => !successful.has(item.hash) && !invalid.has(item.hash)).length;
    const final = pendingTransient === 0 && successful.size > 0;
    const nextDelay = retryDelayMs(attemptCount, pendingTransient === 0);
    const shouldExpire = attemptCount >= MAX_ADMIN_PUSH_ATTEMPTS ||
      now - (Number(previous.firstSeenAtMs) || now) + nextDelay > ADMIN_PUSH_MAX_AGE_MS;
    const nextStatus = final ? "sent" : shouldExpire ? "dead_letter" : "retry";

    const settled = await markAttempt(ref, leaseId, {
      status:nextStatus, nextAttemptAtMs:nextStatus === "retry" ? Date.now()+nextDelay : 0,
      successfulTokenHashes:[...successful], invalidTokenHashes:[...invalid],
      subscriptionCount:subscriptions.length, successCount:successful.size,
      failureCount:pendingTransient, invalidTokenCount:invalid.size,
      attemptLimit:MAX_ADMIN_PUSH_ATTEMPTS, ttlSeconds:3600,
      lastError:nextStatus === "retry" ? "fcm_partial_or_no_valid_subscriber" : null,
      processedAt:FieldValue.serverTimestamp(),
    });
    if (!settled) console.warn("[admin-push] lease mudou antes de consolidar",{orderId});
    if (invalidRefs.length) {
      try {
        const batch=adminDb.batch();
        for (const invalidRef of invalidRefs) batch.set(invalidRef, {
          enabled:false, disabledReason:"invalid_fcm_token", disabledAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp(),
        }, { merge:true });
        await batch.commit();
      } catch (error) { console.warn("[admin-push] desativação de token inválido pendente",error); }
    }
    return { attempted:true, sent:response.successCount, failed:response.failureCount,
      invalidTokens:invalidRefs.length, status:nextStatus };
  } catch (error) {
    console.error("[admin-push] envio falhou; registro preservado para retry", {
      orderId, error:error instanceof Error ? error.message.slice(0,180) : "unknown",
    });
    await reschedule(error instanceof Error ? error.message : "fcm_send_failed");
    // Pedido continua confirmado e a falha não provoca retry duplicado na resposta do checkout.
    return { attempted:true, sent:0, failed:1, reason:"retry_queued" };
  }
}

/** Reaproveita o worker autenticado da integração, sem novo cron/listener. */
export async function retryPendingAdminPushes(limit = 5) {
  const max = Math.max(1, Math.min(8, Math.floor(limit)));
  const collection = adminDb.collection(DISPATCHES);
  const [retrySnap, processingSnap, legacySnap] = await Promise.all([
    collection.where("status","==","retry").limit(24).get(),
    collection.where("status","==","processing").limit(8).get(),
    collection.where("status","==","failed").limit(8).get(),
  ]);
  const candidates = [...retrySnap.docs,...processingSnap.docs,...legacySnap.docs];
  const seen = new Set<string>();
  const result = { scanned:candidates.length, attempted:0, recovered:0, skipped:0, failed:0 };
  for (const doc of candidates) {
    if (result.attempted >= max) break;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const data = doc.data() as DispatchData;
    const decision = mayClaimAdminPush(data, Date.now());
    if (!decision.claim) { result.skipped++; continue; }
    const orderId = clean(data.orderId);
    if (!orderId) { result.skipped++; continue; }
    const createdMs = Number(data.firstSeenAtMs) ||
      (typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : Date.now());
    if (Date.now() - createdMs > ADMIN_PUSH_MAX_AGE_MS) {
      await doc.ref.set({status:"expired",lastError:"old_dispatch_not_replayed",updatedAt:FieldValue.serverTimestamp()},{merge:true});
      result.skipped++; continue;
    }
    try {
      const orderSnap = await adminDb.collection("Pedidos").doc(orderId).get();
      if (!orderSnap.exists) { result.skipped++; continue; }
      const order = orderSnap.data() || {};
      const status = clean(order.status).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      if (status.includes("cancel") || status.includes("finaliz")) {
        await doc.ref.set({status:"expired",lastError:"order_terminal_before_retry",updatedAt:FieldValue.serverTimestamp()},{merge:true});
        result.skipped++;
        continue;
      }
      const customer = order.customerSnapshot && typeof order.customerSnapshot === "object"
        ? order.customerSnapshot as Record<string, unknown> : {};
      result.attempted++;
      const outcome = await sendAdminNewOrderPush({
        orderId,
        customerName:clean(data.customerName)||clean(customer.name)||clean(order.userName)||"Cliente",
        total:Number(data.total??order.total)||0,
        deliveryMode: data.deliveryMode === "pickup" || order.tipoEntrega === "pickup" ? "pickup" : "delivery",
      });
      if (outcome.sent > 0) result.recovered++;
      else if (outcome.failed > 0) result.failed++;
    } catch (error) {
      result.failed++;
      console.warn("[admin-push/retry] falha isolada",{orderId,error:error instanceof Error ? error.message.slice(0,160) : "unknown"});
    }
  }
  return result;
}
