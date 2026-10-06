import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { couponAvailability, couponDiscount, normalizeCoupon } from "@/lib/coupons";
import { normalizeReward, rewardDiscount, rewardIsExpired, type RewardGrantPlan } from "@/lib/rewards";
import { canTransitionOrderStatus } from "@/lib/orderStatus";
import { normalizarStatus } from "@/lib/orderUtils";
import { capacityForTime, normalizeSchedulingConfig, scheduleSlotId } from "@/lib/schedulingConfig";
import { normalizeStoreSettings } from "@/lib/storeSchedule";
import { isScheduledValueAllowed } from "@/lib/orderSchedulePolicy";
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
  userId: string | null;
  order: Record<string, unknown>;
  subtotal: number;
  discount?: CheckoutDiscount | null;
};

const cents = (value: number) => Math.round(value * 100);

export async function createCustomerOrder(input: CreateCustomerOrderInput) {
  const user = auth.currentUser;
  if (input.userId && (!user || user.uid !== input.userId)) throw new Error("AUTH_REQUIRED");
  const token = user ? await user.getIdToken() : "";

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    20_000,
  );

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const payload = await response
      .json()
      .catch(() => ({})) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };

    if (!response.ok || !payload.ok || !payload.id) {
      throw new Error(payload.error || "ORDER_FAILED");
    }

    return { id: payload.id };
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error("ORDER_TIMEOUT");
    }

    if (
      error instanceof TypeError &&
      /fetch|network|failed/i.test(error.message)
    ) {
      throw new Error("ORDER_NETWORK");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function relayOrderStatusEvent(
  eventId: string,
) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const token = await user.getIdToken();
    const controller = new AbortController();

    const timer = window.setTimeout(
      () => controller.abort(),
      5000,
    );

    try {
      await fetch(
        "/api/admin/orders/relay",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventId,
          }),
          signal: controller.signal,
          keepalive: true,
        },
      );
    } finally {
      window.clearTimeout(timer);
    }
  } catch (error) {
    console.warn(
      "[orders/status] fast-lane indisponível; fallback preservado",
      error,
    );
  }
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

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("ORDER_NOT_FOUND");

    const orderData = snapshot.data();
    const current = normalizarStatus(
      typeof orderData.status === "string"
        ? orderData.status
        : undefined,
    );
    const next = normalizarStatus(input.nextStatus);

    // Idempotência primeiro: se outro dispositivo/integração já colocou
    // exatamente no estado solicitado, a ação é sucesso sem nova escrita.
    if (current === next) {
      return {
        changed: false,
        status: current,
        rewardAwarded: false,
      };
    }

    if (!canTransitionOrderStatus(current, next, input.pickup === true)) {
      throw new Error(
        `ORDER_STATUS_CONFLICT:${current}->${next}`,
      );
    }

    let scheduleSlotRef: ReturnType<typeof doc> | null = null;
    let scheduleReserved = 0;
    const leavingSchedule = current === "Agendado" && next !== "Agendado";

    if (
      leavingSchedule &&
      typeof orderData.scheduledFor === "string" &&
      orderData.scheduledFor &&
      !orderData.scheduleSlotReleasedAt
    ) {
      scheduleSlotRef = doc(
        db,
        "schedule_slots",
        scheduleSlotId(orderData.scheduledFor),
      );
      const scheduleSnapshot = await transaction.get(scheduleSlotRef);
      scheduleReserved = scheduleSnapshot.exists()
        ? Math.max(0, Number(scheduleSnapshot.data().reserved) || 0)
        : 0;
    }

    let rewardAwarded = false;
    let rewardRef: ReturnType<typeof doc> | null = null;
    let summaryRef: ReturnType<typeof doc> | null = null;
    let summaryCounts: {total:number;completed:number;cancelled:number}|null = null;

    if ((next === "Finalizado" || next === "Cancelado") && input.rewardPlan) {
      if (
        input.rewardPlan.userId !==
        String(orderData.userId ?? "")
      ) {
        throw new Error("REWARD_USER_MISMATCH");
      }

      summaryRef=doc(db,"Usuarios",input.rewardPlan.userId,"Loyalty","state");
      const summarySnapshot=await transaction.get(summaryRef);
      const stored=summarySnapshot.data()??{};
      const base=stored.initialized===true
        ? {total:Math.max(0,Number(stored.totalOrders)||0),completed:Math.max(0,Number(stored.completedOrders)||0),cancelled:Math.max(0,Number(stored.cancelledOrders)||0)}
        : input.rewardPlan.seed;
      summaryCounts={total:Math.max(base.total,1),completed:base.completed+(next==="Finalizado"?1:0),cancelled:base.cancelled+(next==="Cancelado"?1:0)};
      if(next==="Finalizado"&&input.rewardPlan.reward){
        rewardRef=doc(db,"Usuarios",input.rewardPlan.userId,"RecompensasRecebidas",input.rewardPlan.reward.id);
        rewardAwarded=!(await transaction.get(rewardRef)).exists();
      }
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
      ...(scheduleSlotRef ? {
        scheduleSlotReleasedAt: now,
        scheduleSlotReleasedBy: "admin_status_transition",
      } : {}),
      ...(clearsDeferredProjection ? {
        deliveryCommercialProjectionPending: false,
        deliveryCommercialProjectionTarget: null,
        deliveryCommercialProjectionEventId: null,
        deliveryCommercialProjectionEventType: null,
        deliveryCommercialProjectionAt: null,
      } : {}),
    });

    if (scheduleSlotRef) {
      transaction.set(
        scheduleSlotRef,
        {
          reserved: Math.max(0, scheduleReserved - 1),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (
      rewardRef &&
      input.rewardPlan?.reward &&
      rewardAwarded
    ) {
      transaction.set(rewardRef, {
        ...input.rewardPlan.reward.data,
        earnedAt: serverTimestamp(),
      });
    }
    if(summaryRef&&summaryCounts){
      transaction.set(summaryRef,{version:2,initialized:true,totalOrders:summaryCounts.total,completedOrders:summaryCounts.completed,cancelledOrders:summaryCounts.cancelled,lastOrderId:input.orderId,...(next==="Finalizado"?{lastCompletedOrderId:input.orderId}:{}),updatedAt:serverTimestamp()},{merge:true});
    }

    return {
      changed: true,
      status: next,
      rewardAwarded,
      eventId: event.event_id,
    };
  });

  if (
    result.changed &&
    "eventId" in result &&
    result.eventId
  ) {
    // Status + outbox já estão gravados. O fast-lane só acelera
    // a integração e não deve segurar a resposta do botão.
    void relayOrderStatusEvent(
      result.eventId,
    );
  }

  return result;
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
    const storeRef = doc(db, "settings", "loja");
    const [configSnapshot, storeSnapshot] = await Promise.all([
      transaction.get(configRef),
      transaction.get(storeRef),
    ]);
    const config = normalizeSchedulingConfig(
      configSnapshot.exists()
        ? configSnapshot.data()
        : {},
    );
    const store = normalizeStoreSettings(
      storeSnapshot.exists()
        ? storeSnapshot.data()
        : {},
    );

    const time = input.scheduledFor.slice(11, 16);

    if (
      !isScheduledValueAllowed(
        input.scheduledFor,
        config,
        store,
        new Date(),
        7,
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
