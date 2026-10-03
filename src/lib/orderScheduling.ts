export type OrderScheduleSlot = {
  value: string;
  date: string;
  time: string;
  label: string;
  disabled?: boolean;
};

const DAY_LABELS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"] as const;

function weekday(key: string) {
  const [year,month,day] = key.split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day,12)).getUTCDay();
}

function br(key: string) {
  const [year,month,day] = key.split("-");
  return `${day}/${month}/${year}`;
}

function todayKey() {
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get=(type:string)=>data.find((part)=>part.type===type)?.value??"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function getOrderScheduleSlots(): Promise<OrderScheduleSlot[]> {
  const response = await fetch("/api/orders/schedule-slots", {
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    slots?: Array<{
      value: string;
      date: string;
      time: string;
      disabled?: boolean;
      left?: number;
    }>;
  } | null;

  if (!response.ok || !payload?.ok || !Array.isArray(payload.slots)) {
    throw new Error("SCHEDULE_UNAVAILABLE");
  }

  const today = todayKey();

  return payload.slots.map((slot) => {
    const left = Math.max(0, Number(slot.left) || 0);
    const dayLabel = slot.date === today
      ? "Hoje"
      : `${DAY_LABELS[weekday(slot.date)]} ${br(slot.date)}`;

    return {
      value: slot.value,
      date: slot.date,
      time: slot.time,
      disabled: slot.disabled === true,
      label:
        slot.disabled
          ? `${dayLabel} · ${slot.time} · Lotado`
          : `${dayLabel} · ${slot.time} · ${left} ${left === 1 ? "vaga" : "vagas"}`,
    };
  });
}

export function scheduleHumanLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]} às ${match[4]}:${match[5]}` : value;
}
