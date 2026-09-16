import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { couponAvailability, couponDiscount, normalizeCoupon } from "@/lib/coupons";
import { normalizeReward, rewardDiscount, rewardIsExpired, type RewardGrantPlan } from "@/lib/rewards";
import { canTransitionOrderStatus } from "@/lib/orderStatus";
import { normalizarStatus } from "@/lib/orderUtils";
import { ensureIntegrationEventInTransaction } from "@/lib/integration/firestore";
import {
  buildOrderCreatedEvent,
  buildOrderUpdatedEvent,
} from "@/lib/integration/orderEvents";

export type CheckoutDiscount = {
  code: string;
  rewardId?: string | null;
  expectedDiscount: number;
};

export type CreateCustomerOrderInput = {
  userId: string;
  order: Record<string, unknown>;
  subtotal: number;
  discount?: CheckoutDiscount | null;
};

const cents = (value: number) => Math.round(value * 100);

export async function createCustomerOrder(input: CreateCustomerOrderInput) {
  const orderRef = doc(collection(db, "Pedidos"));
  const code = input.discount?.code.trim().toUpperCase() || "";
  const occurredAt = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    let rewardRefToConsume: DocumentReference | null = null;

    if (input.discount?.rewardId) {
      const rewardRef = doc(
        db,
        "Usuarios",
        input.userId,
        "RecompensasRecebidas",
        input.discount.rewardId,
      );
      const rewardSnap = await transaction.get(rewardRef);
      if (!rewardSnap.exists()) throw new Error("REWARD_NOT_FOUND");

      const reward = normalizeReward(rewardSnap.id, rewardSnap.data());
      if (!reward || reward.code !== code) throw new Error("REWARD_INVALID");
      if (reward.used) throw new Error("REWARD_USED");
      if (rewardIsExpired(reward)) throw new Error("REWARD_EXPIRED");

      const actualDiscount = rewardDiscount(reward, input.subtotal);
      if (
        actualDiscount <= 0 ||
        cents(actualDiscount) !== cents(input.discount.expectedDiscount)
      ) {
        throw new Error("REWARD_CHANGED");
      }

      rewardRefToConsume = rewardRef;
    } else if (code) {
      const couponRef = doc(db, "Cupons", code);
      const couponSnap = await transaction.get(couponRef);
      if (!couponSnap.exists()) throw new Error("COUPON_NOT_FOUND");

      const coupon = normalizeCoupon(couponSnap.id, couponSnap.data());
      const availability = couponAvailability(coupon, input.subtotal);
      if (!availability.ok) {
        throw new Error(
          `COUPON_${availability.reason.toUpperCase().replace(/-/g, "_")}`,
        );
      }

      const actualDiscount = couponDiscount(coupon, input.subtotal);
      if (
        actualDiscount <= 0 ||
        cents(actualDiscount) !== cents(input.discount?.expectedDiscount ?? 0)
      ) {
        throw new Error("COUPON_CHANGED");
      }
    }

    const event = buildOrderCreatedEvent({
      orderId: orderRef.id,
      order: input.order,
      occurredAt,
    });

    await ensureIntegrationEventInTransaction(
      transaction,
      event,
    );

    if (rewardRefToConsume) {
      transaction.update(rewardRefToConsume, {
        used: true,
        usedAt: serverTimestamp(),
        usedOrderId: orderRef.id,
      });
    }

    transaction.set(orderRef, input.order);
  });

  return { id: orderRef.id };
}

export async function updateOrderStatus(input: {
  orderId: string;
  nextStatus: string;
  pickup?: boolean;
  rewardPlan?: RewardGrantPlan | null;
}) {
  const orderRef = doc(db, "Pedidos", input.orderId);
  const now = Timestamp.now();
  const occurredAt = now.toDate().toISOString();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("ORDER_NOT_FOUND");

    const orderData = snapshot.data();
    const current = normalizarStatus(
      typeof orderData.status === "string"
        ? orderData.status
        : undefined,
    );
    const next = normalizarStatus(input.nextStatus);

    if (!canTransitionOrderStatus(current, next, input.pickup === true)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION:${current}->${next}`,
      );
    }

    if (current === next) {
      return {
        changed: false,
        status: current,
        rewardAwarded: false,
      };
    }

    let rewardAwarded = false;
    let rewardRef: ReturnType<typeof doc> | null = null;

    if (next === "Finalizado" && input.rewardPlan) {
      if (
        input.rewardPlan.userId !==
        String(orderData.userId ?? "")
      ) {
        throw new Error("REWARD_USER_MISMATCH");
      }

      rewardRef = doc(
        db,
        "Usuarios",
        input.rewardPlan.userId,
        "RecompensasRecebidas",
        input.rewardPlan.id,
      );

      const rewardSnapshot =
        await transaction.get(rewardRef);

      rewardAwarded =
        !rewardSnapshot.exists();
    }

    const history =
      Array.isArray(orderData.statusHistory)
        ? orderData.statusHistory
        : [];

    const event = buildOrderUpdatedEvent({
      orderId: input.orderId,
      order: orderData,
      status: next,
      occurredAt,
      occurrenceId:
        `status-${now.toMillis()}`,
    });

    await ensureIntegrationEventInTransaction(
      transaction,
      event,
    );

    const deferredTarget =
      typeof orderData.deliveryCommercialProjectionTarget === "string"
        ? normalizarStatus(orderData.deliveryCommercialProjectionTarget)
        : null;
    const clearsDeferredProjection =
      orderData.deliveryCommercialProjectionPending === true &&
      deferredTarget === next;

    transaction.update(orderRef, {
      status: next,
      statusUpdatedAt: now,
      statusHistory: [
        ...history,
        { status: next, at: now },
      ],
      ...(clearsDeferredProjection ? {
        deliveryCommercialProjectionPending: false,
        deliveryCommercialProjectionTarget: null,
        deliveryCommercialProjectionEventId: null,
        deliveryCommercialProjectionEventType: null,
        deliveryCommercialProjectionAt: null,
      } : {}),
    });

    if (
      rewardRef &&
      input.rewardPlan &&
      rewardAwarded
    ) {
      transaction.set(rewardRef, {
        ...input.rewardPlan.data,
        earnedAt: serverTimestamp(),
      });
    }

    return {
      changed: true,
      status: next,
      rewardAwarded,
    };
  });
}
