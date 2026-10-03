import { NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import {
  capacityForTime,
  normalizeSchedulingConfig,
  scheduleSlotId,
} from "@/lib/schedulingConfig";
import { normalizeStoreSettings } from "@/lib/storeSchedule";
import { buildOrderScheduleCandidates } from "@/lib/orderSchedulePolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [configSnap, storeSnap] = await Promise.all([
      adminDb.doc("settings/orderScheduling").get(),
      adminDb.doc("settings/loja").get(),
    ]);

    const config = normalizeSchedulingConfig(
      configSnap.exists ? configSnap.data() : {},
    );
    const store = normalizeStoreSettings(
      storeSnap.exists ? storeSnap.data() : {},
    );

    const candidates = buildOrderScheduleCandidates(
      config,
      store,
      new Date(),
      7,
    );

    const dates = [...new Set(candidates.map((slot) => slot.date))];
    const used = new Map<string, number>();

    if (dates.length) {
      const snapshot = await adminDb
        .collection("schedule_slots")
        .where("date", "in", dates.slice(0, 30))
        .get();

      for (const entry of snapshot.docs) {
        used.set(
          entry.id,
          Math.max(0, Number(entry.data().reserved) || 0),
        );
      }
    }

    const slots = candidates.map((slot) => {
      const capacity = capacityForTime(config, slot.time);
      const reserved = used.get(scheduleSlotId(slot.value)) || 0;
      const left = Math.max(0, capacity - reserved);

      return {
        ...slot,
        disabled: left === 0,
        capacity,
        reserved,
        left,
      };
    });

    return NextResponse.json(
      { ok: true, slots },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[order-schedule] slots", error);
    return NextResponse.json(
      { ok: false, error: "SCHEDULE_UNAVAILABLE" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
