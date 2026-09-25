import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminApp, adminDb } from "@/lib/integration/server/admin";
import { products as fallbackProducts, type Product } from "@/data/products";
import { ADDONS as fallbackAddons, type Addon } from "@/data/addons";
import { buildOrderCreatedEvent } from "@/lib/integration/orderEvents";
import { buildOutboxRecord } from "@/lib/integration/contracts";
import { INTEGRATION_COLLECTIONS } from "@/lib/integration/firestore";
import { capacityForTime, normalizeSchedulingConfig, scheduleSlotId } from "@/lib/schedulingConfig";
import { normalizeCommercialSettings, freeDeliveryThreshold, normalizeCommercialText } from "@/lib/commercialSettings";
import { drainIntegrationOutboxEvent } from "@/lib/integration/server/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Raw = Record<string, unknown>;
type CartLine = { id: string; quantity: number; selectedAddons: Array<{ id: string }>; observation: string; upsellSourceId?: string };
const MAX_BODY = 180_000;
const cents = (value: number) => Math.round(value * 100);
const text = (value: unknown, max = 300) => String(value ?? "").trim().slice(0, max);
const object = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const finiteMoney = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const bool = (value: unknown, fallback = true) => typeof value === "boolean" ? value : fallback;
const timestampMillis = (value: unknown) => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as {toMillis?: unknown}).toMillis === "function") {
    return Number((value as {toMillis: () => number}).toMillis());
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};
function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
function remoteProduct(id: string, raw: Raw, fallback?: Product): Product | null {
  const price = finiteMoney(raw.price ?? raw.preco ?? fallback?.price);
  const name = text(raw.name ?? raw.nome ?? fallback?.name, 120);
  const description = text(raw.description ?? raw.descricao ?? fallback?.description, 800);
  const image = text(raw.image ?? raw.imagem ?? fallback?.image, 500);
  const category = text(raw.category ?? raw.categoria ?? fallback?.category, 80);
  if (!id || !name || price === null || !category) return null;
  const ids = raw.addonIds ?? raw.adicionaisIds;
  const addonIds = Array.isArray(ids) ? ids.map((v) => text(v, 100)).filter(Boolean) : fallback?.addonIds;
  const upsellProductId=text(raw.upsellProductId ?? raw.upsellProdutoId ?? fallback?.upsellProductId,120)||undefined;
  const upsellUnitPrice=finiteMoney(raw.upsellUnitPrice ?? raw.precoUpsell ?? fallback?.upsellUnitPrice);
  return { ...(fallback ?? { id, name, description, image, category, price, disponivel: true }), id, name, description, image, category, price,
    disponivel: bool(raw.disponivel ?? raw.available, fallback?.disponivel ?? true), ...(addonIds ? { addonIds } : {}), ...(upsellProductId?{upsellProductId}:{}), ...(upsellUnitPrice!==null?{upsellUnitPrice}:{}) };
}
function remoteAddon(id: string, raw: Raw, fallback?: Addon): Addon | null {
  const price = finiteMoney(raw.price ?? raw.preco ?? fallback?.price);
  const name = text(raw.name ?? raw.nome ?? fallback?.name, 120);
  if (!id || !name || price === null) return null;
  return { id, name, price, disponivel: bool(raw.disponivel ?? raw.available, fallback?.disponivel ?? true) };
}
function parseLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) throw new Error("CART_INVALID");
  return value.map((entry) => {
    const raw = object(entry); const id = text(raw.id, 120);
    const quantity = Math.trunc(Number(raw.quantity));
    const selectedAddons = Array.isArray(raw.selectedAddons) ? raw.selectedAddons.map((v) => ({ id: text(object(v).id, 120) })).filter((v) => v.id) : [];
    if (!id || !Number.isFinite(quantity) || quantity < 1 || quantity > 30 || selectedAddons.length > 20) throw new Error("CART_INVALID");
    if (new Set(selectedAddons.map((v) => v.id)).size !== selectedAddons.length) throw new Error("ADDON_DUPLICATE");
    const upsellSourceId=text(raw.upsellSourceId,120)||undefined;
    return { id, quantity, selectedAddons, observation:text(raw.observation,300), ...(upsellSourceId?{upsellSourceId}:{}) };
  });
}
function couponData(code: string, raw: Raw) {
  const type = raw.tipo === "percent" || raw.tipo === "porcentagem" || raw.type === "percent" ? "percent" : "fixed";
  return { code, active: raw.ativo === true || raw.active === true, type, value: Math.max(0, Number(raw.valor ?? raw.percent) || 0),
    minOrder: Math.max(0, Number(raw.minOrder ?? raw.pedidoMinimo) || 0), startsAt: timestampMillis(raw.startsAt ?? raw.inicio), expiresAt: timestampMillis(raw.expiresAt ?? raw.validade) };
}
function discountAmount(type: string, value: number, subtotal: number) {
  return Math.min(subtotal, Math.max(0, type === "percent" ? subtotal * value / 100 : value));
}

export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
    if (!bearer) return fail("AUTH_REQUIRED", 401);
    const decoded = await getAuth(adminApp).verifyIdToken(bearer, true);
    const rawText = await request.text();
    if (!rawText || rawText.length > MAX_BODY) return fail("PAYLOAD_INVALID", 413);
    const body = object(JSON.parse(rawText));
    const incoming = object(body.order);
    const lines = parseLines(incoming.itens);
    const clientRequestId = text(incoming.clientRequestId, 80);

    if (!/^[A-Za-z0-9_-]{16,80}$/.test(clientRequestId)) {
      throw new Error("IDEMPOTENCY_REQUIRED");
    }

    const deterministicId =
      "site_" +
      createHash("sha256")
        .update(decoded.uid + ":" + clientRequestId)
        .digest("hex")
        .slice(0, 40);

    const requestFingerprint =
      createHash("sha256")
        .update(
          JSON.stringify({
            userId: decoded.uid,
            clientRequestId,
            lines,
            tipoEntrega:
              incoming.tipoEntrega === "pickup"
                ? "pickup"
                : "delivery",
            endereco: text(
              incoming.endereco,
              600,
            ),
            metodoPagamento: text(
              incoming.metodoPagamento,
              30,
            ),
            scheduledFor: text(
              incoming.scheduledFor,
              80,
            ),
            subtotal: Number(
              incoming.subtotal,
            ),
            taxaEntrega: Number(
              incoming.taxaEntrega,
            ),
            desconto: Number(
              incoming.desconto ?? 0,
            ),
            total: Number(
              incoming.total,
            ),
          }),
        )
        .digest("hex");

    const orderRef = adminDb
      .collection("Pedidos")
      .doc(deterministicId);

    const occurredAt = new Date().toISOString();

    const result = await adminDb.runTransaction(async (tx) => {
      const existingOrder = await tx.get(orderRef);

      if (existingOrder.exists) {
        const existing = existingOrder.data() as Raw;

        if (
          text(existing.userId, 160) !== decoded.uid ||
          text(existing.clientRequestId, 80) !== clientRequestId ||
          text(
            existing.requestFingerprint,
            100,
          ) !== requestFingerprint
        ) {
          throw new Error(
            "IDEMPOTENCY_CONFLICT",
          );
        }

        return {
          id: orderRef.id,
          eventId: null,
          reused: true,
        };
      }
      const productFallback = new Map(fallbackProducts.map((p) => [p.id, p]));
      const addonFallback = new Map(fallbackAddons.map((a) => [a.id, a]));
      const productIds = [...new Set(lines.flatMap(line=>[line.id,line.upsellSourceId].filter(Boolean) as string[]))];
      const addonIds = [...new Set(lines.flatMap((line) => line.selectedAddons.map((a) => a.id)))];
      const productSnaps = await Promise.all(productIds.map((id) => tx.get(adminDb.collection("CatalogoProdutos").doc(id))));
      const addonSnaps = await Promise.all(addonIds.map((id) => tx.get(adminDb.collection("CatalogoAdicionais").doc(id))));
      const remoteProducts = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as Raw]));
      const remoteAddons = new Map(addonSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as Raw]));

      const canonicalItems = lines.map((line) => {
        const fallback = productFallback.get(line.id);
        const remote = remoteProducts.get(line.id);
        const product = remote ? remoteProduct(line.id, remote, fallback) : fallback;
        if (!product || product.disponivel === false) throw new Error("PRODUCT_UNAVAILABLE");
        const allowed = product.category === "bebidas" ? new Set<string>() : product.addonIds ? new Set(product.addonIds) : null;
        const selectedAddons = line.selectedAddons.map(({ id }) => {
          const base = addonFallback.get(id); const remoteRaw = remoteAddons.get(id);
          const addon = remoteRaw ? remoteAddon(id, remoteRaw, base) : base;
          if (!addon || addon.disponivel === false || (allowed && !allowed.has(id))) throw new Error("ADDON_UNAVAILABLE");
          return { id: addon.id, name: addon.name, price: addon.price };
        });
        let basePrice=product.price;
        if(line.upsellSourceId){
          if(selectedAddons.length) throw new Error("UPSELL_INVALID");
          const sf=productFallback.get(line.upsellSourceId), sr=remoteProducts.get(line.upsellSourceId);
          const source=sr?remoteProduct(line.upsellSourceId,sr,sf):sf;
          const sourceQty=lines.filter(x=>x.id===line.upsellSourceId&&!x.upsellSourceId).reduce((n,x)=>n+x.quantity,0);
          const usedQty=lines.filter(x=>x.id===line.id&&x.upsellSourceId===line.upsellSourceId).reduce((n,x)=>n+x.quantity,0);
          if(!source||source.disponivel===false||source.upsellProductId!==product.id||source.upsellUnitPrice==null||source.upsellUnitPrice<0||source.upsellUnitPrice>=product.price||sourceQty<1||usedQty>sourceQty) throw new Error("UPSELL_CHANGED");
          basePrice=source.upsellUnitPrice;
        }
        const unitPrice =
          basePrice +
          selectedAddons.reduce(
            (sum, addon) => sum + addon.price,
            0,
          );

        const pricingSnapshot = line.upsellSourceId
          ? {
              type: "upsell",
              catalogUnitPrice: product.price,
              chargedBasePrice: basePrice,
              upsellSourceId: line.upsellSourceId,
            }
          : {
              type: "catalog",
              catalogUnitPrice: product.price,
              chargedBasePrice: basePrice,
              upsellSourceId: null,
            };

        const commercialKey = line.upsellSourceId
          ? `upsell:${line.upsellSourceId}`
          : "regular";

        return {
          ...product,
          price: unitPrice,
          quantity: line.quantity,
          selectedAddons,
          observation: line.observation,
          pricingSnapshot,
          ...(line.upsellSourceId
            ? { upsellSourceId: line.upsellSourceId }
            : {}),
          cartId:
            `${product.id}|` +
            `${selectedAddons.map((a) => a.id).sort().join("-")}|` +
            `${line.observation}|${commercialKey}`,
        };
      });
      const subtotal = canonicalItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (cents(subtotal) !== cents(Number(body.subtotal)) || cents(subtotal) !== cents(Number(incoming.subtotal))) throw new Error("PRICE_CHANGED");

      const deliveryMode = incoming.tipoEntrega === "pickup" ? "pickup" : "delivery";
      const delivery = object(incoming.deliverySnapshot);
      const district = text(delivery.district, 120);
      const [ratesSnap, deliverySettingsSnap, commercialSnap] = await Promise.all([
        tx.get(adminDb.doc("TaxasDeEntrega/bairros/lista/tabela")), tx.get(adminDb.doc("settings/delivery")), tx.get(adminDb.doc("settings/commercial")),
      ]);
      let fee = 0;
      if (deliveryMode === "delivery") {
        const configured = Number(deliverySettingsSnap.data()?.defaultFee);
        fee = Number.isFinite(configured) && configured >= 0 ? configured : 6;
        const rates = Array.isArray(ratesSnap.data()?.data) ? ratesSnap.data()!.data as Array<Raw> : [];
        const key = normalizeCommercialText(district);
        const found = rates.find((rate) => { const name = normalizeCommercialText(rate.nome); return name === key || name.includes(key) || key.includes(name); });
        const selected = Number(found?.taxa);
        if (found && Number.isFinite(selected) && selected >= 0) fee = selected;
        const settings = normalizeCommercialSettings(commercialSnap.exists ? commercialSnap.data() as Raw : undefined);
        const threshold = freeDeliveryThreshold(settings, district);
        if (threshold !== null && subtotal >= threshold) fee = 0;
      }
      if (cents(fee) !== cents(Number(incoming.taxaEntrega))) throw new Error("DELIVERY_CHANGED");

      const discountInput = object(body.discount);
      const code = text(discountInput.code, 80).toUpperCase();
      const rewardId = text(discountInput.rewardId, 160);
      let discount = 0;
      let rewardRef: FirebaseFirestore.DocumentReference | null = null;
      if (rewardId) {
        rewardRef = adminDb.doc(`Usuarios/${decoded.uid}/RecompensasRecebidas/${rewardId}`);
        const snap = await tx.get(rewardRef); if (!snap.exists) throw new Error("REWARD_NOT_FOUND");
        const reward = snap.data() as Raw;
        if (text(reward.code).toUpperCase() !== code || reward.used === true) throw new Error("REWARD_INVALID");
        const expires = timestampMillis(reward.expiresAt); if (expires && expires < Date.now()) throw new Error("REWARD_EXPIRED");
        const minOrder = Math.max(0, Number(reward.minOrder) || 0); if (subtotal < minOrder) throw new Error("REWARD_CHANGED");
        discount = discountAmount(reward.discountType === "percent" ? "percent" : "fixed", Math.max(0, Number(reward.discountValue) || 0), subtotal);
      } else if (code) {
        const snap = await tx.get(adminDb.collection("Cupons").doc(code)); if (!snap.exists) throw new Error("COUPON_NOT_FOUND");
        const coupon = couponData(code, snap.data() as Raw); const now = Date.now();
        if (!coupon.active || coupon.value <= 0 || subtotal < coupon.minOrder || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now)) throw new Error("COUPON_CHANGED");
        discount = discountAmount(coupon.type, coupon.value, subtotal);
      }
      if (cents(discount) !== cents(Number(discountInput.expectedDiscount ?? incoming.desconto ?? 0))) throw new Error(code ? "COUPON_CHANGED" : "PRICE_CHANGED");
      const total = Math.max(0, subtotal + fee - discount);
      if (cents(total) !== cents(Number(incoming.total))) throw new Error("PRICE_CHANGED");

      const isScheduled = incoming.isAgendamento === true;
      const scheduledFor = isScheduled ? text(incoming.scheduledFor, 80) : "";
      let slotRef: FirebaseFirestore.DocumentReference | null = null;
      let slotData: Raw | null = null;
      if (isScheduled) {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-03:00$/.test(scheduledFor)) throw new Error("SCHEDULE_REQUIRED");
        const configSnap = await tx.get(adminDb.doc("settings/orderScheduling"));
        const config = normalizeSchedulingConfig(configSnap.exists ? configSnap.data() : {}); const time = scheduledFor.slice(11, 16);
        if (!config.enabled || (config.enabledTimes.length && !config.enabledTimes.includes(time))) throw new Error("SCHEDULE_SLOT_DISABLED");
        slotRef = adminDb.collection("schedule_slots").doc(scheduleSlotId(scheduledFor)); const slot = await tx.get(slotRef);
        const reserved = slot.exists ? Math.max(0, Number(slot.data()?.reserved) || 0) : 0; const capacity = capacityForTime(config, time);
        if (reserved >= capacity) throw new Error("SCHEDULE_SLOT_FULL");
        slotData = { scheduledFor, date: scheduledFor.slice(0, 10), time, reserved: reserved + 1, capacity, updatedAt: FieldValue.serverTimestamp() };
      }

      const method = ["pix", "cartao", "dinheiro"].includes(String(incoming.metodoPagamento)) ? String(incoming.metodoPagamento) : "";
      if (!method) throw new Error("PAYMENT_INVALID");
      const phone = text(incoming.userPhone, 30); if (!/^\D*\d(?:\D*\d){9,10}\D*$/.test(phone)) throw new Error("PHONE_INVALID");
      const customer = object(incoming.customerSnapshot);
      const canonicalOrder: Raw = {
        userId: decoded.uid,
        clientRequestId,
        requestFingerprint, userName: text(incoming.userName, 120) || text(decoded.name, 120) || "Cliente", userEmail: decoded.email || "", userPhone: phone,
        itens: canonicalItems, subtotal, taxaEntrega: fee, desconto: discount, cupom: discount > 0 && code ? code : null, rewardId: rewardId || null, total,
        metodoPagamento: method, trocoPara: method === "dinheiro" ? text(incoming.trocoPara, 40) || null : null, observacao: text(incoming.observacao, 300) || null,
        endereco: deliveryMode === "pickup" ? "RETIRADA NO LOCAL" : text(incoming.endereco, 600), tipoEntrega: deliveryMode,
        data: FieldValue.serverTimestamp(),
        status: isScheduled ? "Agendado" : "Pendente",
        isAgendamento: isScheduled,
        pricingIntegrityVersion: 1,
        scheduledFor: isScheduled ? scheduledFor : null, scheduledLabel: isScheduled ? text(incoming.scheduledLabel, 100) : null,
        scheduleWindowMinutes: isScheduled ? 30 : null, sourceSystem: "dfl_site", orderSchemaVersion: 2,
        customerSnapshot: { id: decoded.uid, name: text(customer.name, 120) || text(incoming.userName, 120), email: decoded.email || "", phone, phoneE164: `+55${phone.replace(/\D/g, "")}` },
        deliverySnapshot: deliveryMode === "pickup" ? null : { cep: text(delivery.cep, 20), street: text(delivery.street, 180), number: text(delivery.number, 30), district, complement: text(delivery.complement, 180), reference: text(delivery.reference, 240) },
      };
      if (deliveryMode === "delivery" && (!text(delivery.street) || !text(delivery.number) || !district)) throw new Error("ADDRESS_INVALID");
      const event = buildOrderCreatedEvent({ orderId: orderRef.id, order: canonicalOrder, occurredAt });
      tx.create(orderRef, canonicalOrder);

      tx.set(
        adminDb.collection("Usuarios").doc(decoded.uid),
        {
          pedidosFeitos: FieldValue.increment(1),
        },
        { merge: true },
      );
      tx.create(adminDb.collection(INTEGRATION_COLLECTIONS.outbox).doc(encodeURIComponent(event.event_id)), buildOutboxRecord(event, occurredAt));
      if (rewardRef) tx.update(rewardRef, { used: true, usedAt: FieldValue.serverTimestamp(), usedOrderId: orderRef.id });
      if (slotRef && slotData) tx.set(slotRef, slotData, { merge: true });
      return {
        id: orderRef.id,
        eventId: event.event_id,
        reused: false,
      };
    });
    let integration = result.reused
      ? { queued: false, sent: true }
      : { queued: true, sent: false };

    if (result.eventId) {
      try {
        const relay = await drainIntegrationOutboxEvent(result.eventId);

        integration = {
          queued: relay.sent !== 1,
          sent: relay.sent === 1,
        };
      } catch (relayError) {
        console.error(
          "[orders/create] pedido salvo; relay seguirá na outbox",
          relayError,
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        id: result.id,
        integration,
        reused: result.reused,
      },
      {
        status: result.reused ? 200 : 201,
      },
    );
  } catch (error) {
    const rawCode = String((error && typeof error === "object" && "code" in error) ? (error as { code?: unknown }).code ?? "" : "").toLowerCase();
    const original = error instanceof Error ? error.message : "ORDER_FAILED";
    const message = rawCode.includes("resource-exhausted") || rawCode === "8" || /quota|resource exhausted/i.test(original) ? "SERVICE_BUSY" : rawCode.includes("permission-denied") || rawCode === "7" ? "SERVICE_CONFIG" : rawCode.includes("unavailable") || rawCode === "14" ? "SERVICE_UNAVAILABLE" : original;
    const known = /^(AUTH_REQUIRED|PAYLOAD_INVALID|IDEMPOTENCY_|CART_INVALID|ADDON_DUPLICATE|PRODUCT_UNAVAILABLE|ADDON_UNAVAILABLE|UPSELL_|PRICE_CHANGED|DELIVERY_CHANGED|COUPON_|REWARD_|SCHEDULE_|PAYMENT_INVALID|PHONE_INVALID|ADDRESS_INVALID|SERVICE_BUSY|SERVICE_CONFIG|SERVICE_UNAVAILABLE)/.test(message);
    console.error("[orders/create]", known ? message : error);
    return fail(known ? message : "ORDER_FAILED", known ? 409 : 500);
  }
}
