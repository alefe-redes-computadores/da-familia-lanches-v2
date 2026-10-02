// src/lib/orderScheduling.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  capacityForTime,
  getSchedulingConfig,
  scheduleSlotId,
} from "@/lib/schedulingConfig";
import {
  normalizeStoreSettings,
} from "@/lib/storeSchedule";

export type OrderScheduleSlot = {
  value: string;
  date: string;
  time: string;
  label: string;
  disabled?: boolean;
};

const ZONE = "America/Sao_Paulo";
const DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

const DAY_LABELS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

function parts(date = new Date()) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    );

  const formatted =
    formatter.formatToParts(date);

  const get = (type: string) =>
    formatted.find(
      (part) => part.type === type,
    )?.value ?? "";

  return {
    date:
      `${get("year")}-` +
      `${get("month")}-` +
      `${get("day")}`,
    time:
      `${get("hour")}:` +
      `${get("minute")}`,
  };
}

function mins(value: string) {
  const [hours, minutes] =
    value.split(":").map(Number);

  return hours * 60 + minutes;
}

function hhmm(value: number) {
  return (
    `${String(
      Math.floor(value / 60),
    ).padStart(2, "0")}:` +
    `${String(value % 60)
      .padStart(2, "0")}`
  );
}

function addDays(
  key: string,
  amount: number,
) {
  const [year, month, day] =
    key.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + amount,
      12,
    ),
  );

  return (
    `${date.getUTCFullYear()}-` +
    `${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}-` +
    `${String(
      date.getUTCDate(),
    ).padStart(2, "0")}`
  );
}

function weekday(key: string) {
  const [year, month, day] =
    key.split("-").map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
    ),
  ).getUTCDay();
}

function br(key: string) {
  const [year, month, day] =
    key.split("-");

  return `${day}/${month}/${year}`;
}

export async function getOrderScheduleSlots(
  daysAhead = 7,
): Promise<OrderScheduleSlot[]> {
  const config =
    await getSchedulingConfig();

  if (!config.enabled) {
    return [];
  }

  const storeSnapshot =
    await getDoc(
      doc(db, "settings", "loja"),
    );

  const store =
    normalizeStoreSettings(
      storeSnapshot.exists()
        ? storeSnapshot.data()
        : {},
    );

  const now = parts();
  const nowMinutes = mins(now.time);
  const list: OrderScheduleSlot[] = [];

  for (
    let offset = 0;
    offset < daysAhead;
    offset += 1
  ) {
    const date =
      addDays(now.date, offset);

    const dayIndex =
      weekday(date);

    const day =
      DAY_KEYS[dayIndex];

    const rule =
      store.schedule[day];

    const exception =
      store.exceptions.find(
        (item) => item.date === date,
      );

    if (exception?.closed) {
      continue;
    }

    const exceptionWindow =
      Boolean(
        exception?.open &&
        exception?.close,
      );

    const enabled =
      exceptionWindow ||
      rule.enabled;

    if (!enabled) {
      continue;
    }

    const open =
      exception?.open ??
      rule.open;

    const close =
      exception?.close ??
      rule.close;

    if (!open || !close) {
      continue;
    }

    let start = mins(open);
    let end = mins(close);

    if (end <= start) {
      end += 1440;
    }

    for (
      let minute =
        Math.ceil(
          start /
          config.intervalMinutes,
        ) *
        config.intervalMinutes;
      minute < end;
      minute +=
        config.intervalMinutes
    ) {
      const slotDate =
        minute >= 1440
          ? addDays(date, 1)
          : date;

      const time =
        hhmm(minute % 1440);

      if (
        config.enabledTimes.length &&
        !config.enabledTimes.includes(
          time,
        )
      ) {
        continue;
      }

      if (
        slotDate === now.date &&
        mins(time) <
          nowMinutes +
          config.leadMinutes
      ) {
        continue;
      }

      list.push({
        value:
          `${slotDate}T` +
          `${time}:00-03:00`,
        date: slotDate,
        time,
        label:
          `${
            slotDate === now.date
              ? "Hoje"
              : `${DAY_LABELS[
                  weekday(slotDate)
                ]} ${br(slotDate)}`
          } · ${time}`,
      });
    }
  }

  const dates = [
    ...new Set(
      list.map((item) => item.date),
    ),
  ];

  const used =
    new Map<string, number>();

  if (dates.length) {
    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "schedule_slots",
          ),
          where(
            "date",
            "in",
            dates.slice(0, 30),
          ),
        ),
      );

    snapshot.forEach((entry) => {
      used.set(
        entry.id,
        Math.max(
          0,
          Number(
            entry.data().reserved,
          ) || 0,
        ),
      );
    });
  }

  return list.map((item) => {
    const reserved =
      used.get(
        scheduleSlotId(item.value),
      ) || 0;

    const capacity =
      capacityForTime(
        config,
        item.time,
      );

    const left =
      Math.max(
        0,
        capacity - reserved,
      );

    return {
      ...item,
      disabled: left === 0,
      label:
        left === 0
          ? `${item.label} · Lotado`
          : `${item.label} · ` +
            `${left} ` +
            `${left === 1
              ? "vaga"
              : "vagas"}`,
    };
  });
}

export function scheduleHumanLabel(
  value: string,
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
    );

  return match
    ? `${match[3]}/${match[2]} às ${match[4]}:${match[5]}`
    : value;
}
