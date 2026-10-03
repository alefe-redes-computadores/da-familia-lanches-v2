import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { adminApp, adminDb } from "@/lib/integration/server/admin";

const SUBSCRIPTIONS = "AdminPushSubscriptions";
const DISPATCHES = "AdminPushDispatches";
const TOKEN_LIMIT = 50;

type AdminNewOrderPush = {
  orderId: string;
  customerName: string;
  total: number;
  deliveryMode: "delivery" | "pickup";
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number.isFinite(value) ? value : 0);
}
function invalidTokenCode(code: string) {
  return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token") || code.includes("invalid-argument");
}
function dispatchId(orderId: string) {
  return createHash("sha256").update(`admin-new-order-v1:${orderId}`).digest("hex");
}

export async function sendAdminNewOrderPush(input: AdminNewOrderPush) {
  const orderId = input.orderId.trim();
  if (!orderId) return { attempted:false, sent:0, failed:0, reason:"missing_order_id" };

  const dispatchRef = adminDb.collection(DISPATCHES).doc(dispatchId(orderId));
  try {
    await dispatchRef.create({ protocol:"admin-new-order-v1", orderId, status:"processing", createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
  } catch (error) {
    const code = String((error as { code?:unknown } | null)?.code ?? "").toLowerCase();
    if (code === "6" || code.includes("already") || code.includes("exists"))
      return { attempted:false, sent:0, failed:0, reason:"deduplicated" };
    throw error;
  }

  try {
    const snapshot = await adminDb.collection(SUBSCRIPTIONS).where("enabled", "==", true).limit(TOKEN_LIMIT).get();
    const subscriptions = snapshot.docs.map((doc) => ({ ref:doc.ref, token:String(doc.data().token ?? "").trim() })).filter((item) => item.token.length >= 20);
    if (!subscriptions.length) {
      await dispatchRef.set({ status:"no_subscribers", subscriptionCount:0, processedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() }, { merge:true });
      return { attempted:true, sent:0, failed:0, reason:"no_subscribers" };
    }

    const message: MulticastMessage = {
      tokens: subscriptions.map((item) => item.token),
      data: {
        type:"admin.new_order",
        title:"Novo pedido recebido",
        body:`${input.customerName || "Cliente"} · ${money(input.total)} · ${input.deliveryMode === "pickup" ? "Retirada" : "Entrega"}`,
        orderId,
        tag:`new-order-${orderId}`,
        url:`/admin?stage=cozinha&order=${encodeURIComponent(orderId)}`,
      },
      webpush: { headers:{ Urgency:"high", TTL:"120" }, fcmOptions:{ link:"https://admin.dafamilialanches.com.br/" } },
    };

    const outcomes = await Promise.allSettled([getMessaging(adminApp).sendEachForMulticast(message)]);
    const first = outcomes[0];
    if (first.status !== "fulfilled") throw first.reason;
    const response = first.value;

    const invalidRefs = subscriptions.map((item,index) => ({ ref:item.ref, response:response.responses[index] })).filter(({ response:item }) => !item?.success && invalidTokenCode(String(item?.error?.code ?? ""))).map((item) => item.ref);
    if (invalidRefs.length) {
      const batch = adminDb.batch();
      for (const ref of invalidRefs) batch.set(ref, { enabled:false, disabledReason:"invalid_fcm_token", disabledAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() }, { merge:true });
      await batch.commit();
    }

    await dispatchRef.set({
      status:response.successCount > 0 ? "sent" : "failed",
      subscriptionCount:subscriptions.length,
      successCount:response.successCount,
      failureCount:response.failureCount,
      invalidTokenCount:invalidRefs.length,
      processedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
    }, { merge:true });

    return { attempted:true, sent:response.successCount, failed:response.failureCount, invalidTokens:invalidRefs.length };
  } catch (error) {
    await dispatchRef.set({ status:"failed", lastError:error instanceof Error ? error.message.slice(0,500) : "admin_push_failed", processedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    throw error;
  }
}
