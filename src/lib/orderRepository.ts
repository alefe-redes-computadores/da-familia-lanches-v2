import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { couponAvailability, couponDiscount, normalizeCoupon } from "@/lib/coupons";
import { normalizeReward, rewardDiscount, rewardIsExpired, type RewardGrantPlan } from "@/lib/rewards";
import { canTransitionOrderStatus } from "@/lib/orderStatus";
import { normalizarStatus } from "@/lib/orderUtils";

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

  await runTransaction(db, async (transaction) => {
    if (input.discount?.rewardId) {
      const rewardRef = doc(db, "Usuarios", input.userId, "RecompensasRecebidas", input.discount.rewardId);
      const rewardSnap = await transaction.get(rewardRef);
      if (!rewardSnap.exists()) throw new Error("REWARD_NOT_FOUND");
      const reward = normalizeReward(rewardSnap.id, rewardSnap.data());
      if (!reward || reward.code !== code) throw new Error("REWARD_INVALID");
      if (reward.used) throw new Error("REWARD_USED");
      if (rewardIsExpired(reward)) throw new Error("REWARD_EXPIRED");
      const actualDiscount = rewardDiscount(reward, input.subtotal);
      if (actualDiscount <= 0 || cents(actualDiscount) !== cents(input.discount.expectedDiscount)) {
        throw new Error("REWARD_CHANGED");
      }
      transaction.update(rewardRef, {
        used: true,
        usedAt: serverTimestamp(),
        usedOrderId: orderRef.id,
      });
    } else if (code) {
      const couponRef = doc(db, "Cupons", code);
      const couponSnap = await transaction.get(couponRef);
      if (!couponSnap.exists()) throw new Error("COUPON_NOT_FOUND");
      const coupon = normalizeCoupon(couponSnap.id, couponSnap.data());
      const availability = couponAvailability(coupon, input.subtotal);
      if (!availability.ok) throw new Error(`COUPON_${availability.reason.toUpperCase().replace(/-/g, "_")}`);
      const actualDiscount = couponDiscount(coupon, input.subtotal);
      if (actualDiscount <= 0 || cents(actualDiscount) !== cents(input.discount?.expectedDiscount ?? 0)) {
        throw new Error("COUPON_CHANGED");
      }
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

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("ORDER_NOT_FOUND");

    const current = normalizarStatus(typeof snapshot.data().status === "string" ? snapshot.data().status : undefined);
    const next = normalizarStatus(input.nextStatus);
    if (!canTransitionOrderStatus(current, next, input.pickup === true)) {
      throw new Error(`INVALID_STATUS_TRANSITION:${current}->${next}`);
    }
    if (current === next) return { changed: false, status: current, rewardAwarded: false };

    let rewardAwarded = false;
    let rewardRef: ReturnType<typeof doc> | null = null;
    if (next === "Finalizado" && input.rewardPlan) {
      if (input.rewardPlan.userId !== String(snapshot.data().userId ?? "")) throw new Error("REWARD_USER_MISMATCH");
      rewardRef = doc(db, "Usuarios", input.rewardPlan.userId, "RecompensasRecebidas", input.rewardPlan.id);
      const rewardSnapshot = await transaction.get(rewardRef);
      rewardAwarded = !rewardSnapshot.exists();
    }

    const now = Timestamp.now();
    const history = Array.isArray(snapshot.data().statusHistory) ? snapshot.data().statusHistory : [];
    transaction.update(orderRef, {
      status: next,
      statusUpdatedAt: now,
      statusHistory: [...history, { status: next, at: now }],
    });

    if (rewardRef && input.rewardPlan && rewardAwarded) {
      transaction.set(rewardRef, {
        ...input.rewardPlan.data,
        earnedAt: serverTimestamp(),
      });
    }

    return { changed: true, status: next, rewardAwarded };
  });
}
