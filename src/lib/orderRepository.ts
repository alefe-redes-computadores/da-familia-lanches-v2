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
import { capacityForTime, normalizeSchedulingConfig, scheduleSlotId } from "@/lib/schedulingConfig";
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

    const scheduledFor=typeof input.order.scheduledFor==="string"?input.order.scheduledFor:"";
    if(input.order.isAgendamento===true&&scheduledFor){const cr=doc(db,"settings","orderScheduling"),cs=await transaction.get(cr),cfg=normalizeSchedulingConfig(cs.exists()?cs.data():{}),time=scheduledFor.slice(11,16);if(!cfg.enabled||(cfg.enabledTimes.length&&!cfg.enabledTimes.includes(time)))throw new Error("SCHEDULE_SLOT_DISABLED");const sr=doc(db,"schedule_slots",scheduleSlotId(scheduledFor)),ss=await transaction.get(sr),reserved=ss.exists()?Math.max(0,Number(ss.data().reserved)||0):0,capacity=capacityForTime(cfg,time);if(reserved>=capacity)throw new Error("SCHEDULE_SLOT_FULL");transaction.set(sr,{scheduledFor,date:scheduledFor.slice(0,10),time,reserved:reserved+1,capacity,updatedAt:serverTimestamp()},{merge:true})}

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


export async function rescheduleCustomerOrder(input: {
  orderId: string;
  userId: string;
  scheduledFor: string;
  scheduledLabel: string;
}) {
  const orderRef = doc(db, "Pedidos", input.orderId);
  const now = Timestamp.now();
  const occurredAt = now.toDate().toISOString();

  return runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error("ORDER_NOT_FOUND");

    const order = orderSnapshot.data();

    if (String(order.userId ?? "") !== input.userId) {
      throw new Error("ORDER_FORBIDDEN");
    }

    if (normalizarStatus(order.status) !== "Agendado") {
      throw new Error("ORDER_NOT_RESCHEDULABLE");
    }

    const previousScheduledFor =
      typeof order.scheduledFor === "string"
        ? order.scheduledFor
        : "";

    if (previousScheduledFor === input.scheduledFor) {
      return { changed: false };
    }

    const configRef = doc(db, "settings", "orderScheduling");
    const configSnapshot = await transaction.get(configRef);
    const config = normalizeSchedulingConfig(
      configSnapshot.exists()
        ? configSnapshot.data()
        : {},
    );

    const time = input.scheduledFor.slice(11, 16);

    if (
      !config.enabled ||
      (
        config.enabledTimes.length &&
        !config.enabledTimes.includes(time)
      )
    ) {
      throw new Error("SCHEDULE_SLOT_DISABLED");
    }

    const newSlotRef = doc(
      db,
      "schedule_slots",
      scheduleSlotId(input.scheduledFor),
    );

    const newSlotSnapshot =
      await transaction.get(newSlotRef);

    const newReserved = newSlotSnapshot.exists()
      ? Math.max(
          0,
          Number(newSlotSnapshot.data().reserved) || 0,
        )
      : 0;

    const capacity = capacityForTime(config, time);

    if (newReserved >= capacity) {
      throw new Error("SCHEDULE_SLOT_FULL");
    }

    let oldSlotRef: ReturnType<typeof doc> | null = null;
    let oldReserved = 0;

    if (previousScheduledFor) {
      oldSlotRef = doc(
        db,
        "schedule_slots",
        scheduleSlotId(previousScheduledFor),
      );

      const oldSlotSnapshot =
        await transaction.get(oldSlotRef);

      oldReserved = oldSlotSnapshot.exists()
        ? Math.max(
            0,
            Number(oldSlotSnapshot.data().reserved) || 0,
          )
        : 0;
    }

    const nextOrder = {
      ...order,
      scheduledFor: input.scheduledFor,
      scheduledLabel: input.scheduledLabel,
      scheduleUpdatedAt: now,
      statusUpdatedAt: now,
    };

    const event = buildOrderUpdatedEvent({
      orderId: input.orderId,
      order: nextOrder,
      status: "Agendado",
      occurredAt,
      occurrenceId: `customer-reschedule-${input.orderId}-${input.scheduledFor}`,
    });

    await ensureIntegrationEventInTransaction(
      transaction,
      event,
    );

    /*
     * Todas as leituras da transação já aconteceram.
     * A partir daqui somente writes.
     */
    if (oldSlotRef) {
      transaction.set(
        oldSlotRef,
        {
          reserved: Math.max(0, oldReserved - 1),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    transaction.set(
      newSlotRef,
      {
        scheduledFor: input.scheduledFor,
        date: input.scheduledFor.slice(0, 10),
        time,
        reserved: newReserved + 1,
        capacity,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.update(orderRef, {
      scheduledFor: input.scheduledFor,
      scheduledLabel: input.scheduledLabel,
      scheduleUpdatedAt: now,
      statusUpdatedAt: now,
    });

    return { changed: true };
  });
}

export async function cancelCustomerScheduledOrder(input: {
  orderId: string;
  userId: string;
}) {
  const orderRef = doc(db, "Pedidos", input.orderId);
  const now = Timestamp.now();
  const occurredAt = now.toDate().toISOString();

  return runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const order = orderSnapshot.data();

    if (String(order.userId ?? "") !== input.userId) {
      throw new Error("ORDER_FORBIDDEN");
    }

    if (normalizarStatus(order.status) !== "Agendado") {
      throw new Error("ORDER_NOT_CANCELLABLE");
    }

    const scheduledFor =
      typeof order.scheduledFor === "string"
        ? order.scheduledFor
        : "";

    let slotRef: ReturnType<typeof doc> | null = null;
    let reserved = 0;

    if (scheduledFor) {
      slotRef = doc(
        db,
        "schedule_slots",
        scheduleSlotId(scheduledFor),
      );

      const slotSnapshot =
        await transaction.get(slotRef);

      reserved = slotSnapshot.exists()
        ? Math.max(
            0,
            Number(slotSnapshot.data().reserved) || 0,
          )
        : 0;
    }

    const history = Array.isArray(order.statusHistory)
      ? order.statusHistory
      : [];

    const nextOrder = {
      ...order,
      status: "Cancelado",
      statusUpdatedAt: now,
      statusHistory: [
        ...history,
        {
          status: "Cancelado",
          at: now,
        },
      ],
      scheduleSlotReleasedAt: now,
      cancelledBy: "customer",
    };

    const event = buildOrderUpdatedEvent({
      orderId: input.orderId,
      order: nextOrder,
      status: "Cancelado",
      occurredAt,
      occurrenceId: `customer-cancel-${input.orderId}`,
    });

    await ensureIntegrationEventInTransaction(
      transaction,
      event,
    );

    if (slotRef) {
      transaction.set(
        slotRef,
        {
          reserved: Math.max(0, reserved - 1),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    transaction.update(orderRef, {
      status: "Cancelado",
      statusUpdatedAt: now,
      statusHistory: nextOrder.statusHistory,
      scheduleSlotReleasedAt: now,
      cancelledBy: "customer",
    });

    return { changed: true };
  });
}
