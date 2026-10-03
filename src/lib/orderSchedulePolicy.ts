export type SchedulePolicyConfig = {
  enabled: boolean;
  intervalMinutes: number;
  defaultCapacity: number;
  leadMinutes: number;
  enabledTimes: string[];
  capacityByTime: Record<string, number>;
};

export type SchedulePolicyStore = {
  timezone: string;
  schedule: Record<string, { enabled: boolean; open: string; close: string }>;
  exceptions: Array<{
    date: string;
    closed: boolean;
    open?: string;
    close?: string;
  }>;
};

export type ScheduleCandidate = {
  value: string;
  date: string;
  time: string;
};

const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DEFAULT_ZONE = "America/Sao_Paulo";

function parts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const data = formatter.formatToParts(date);
  const get = (type: string) => data.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function mins(value: string) {
  const [h,m] = value.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2,"0")}:${String(value % 60).padStart(2,"0")}`;
}

export function addScheduleDays(key: string, amount: number) {
  const [year,month,day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
}

function weekday(key: string) {
  const [year,month,day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function dayDistance(from: string, to: string) {
  const parse = (value: string) => {
    const [y,m,d] = value.split("-").map(Number);
    return Date.UTC(y,m-1,d);
  };
  return Math.round((parse(to)-parse(from))/86400000);
}

function effectiveWindow(store: SchedulePolicyStore, date: string) {
  const exception = store.exceptions.find((item) => item.date === date);
  if (exception?.closed) return null;

  const rule = store.schedule[DAY_KEYS[weekday(date)]];
  if (!rule) return null;

  const exceptionWindow = Boolean(exception?.open && exception?.close);
  if (!exceptionWindow && !rule.enabled) return null;

  const open = exception?.open ?? rule.open;
  const close = exception?.close ?? rule.close;
  if (!/^\d{2}:\d{2}$/.test(open || "") || !/^\d{2}:\d{2}$/.test(close || "")) return null;

  return { open, close };
}

export function buildOrderScheduleCandidates(
  config: SchedulePolicyConfig,
  store: SchedulePolicyStore,
  now = new Date(),
  daysAhead = 7,
): ScheduleCandidate[] {
  if (!config.enabled || daysAhead < 1) return [];

  const timezone = store.timezone || DEFAULT_ZONE;
  const current = parts(now, timezone);
  const currentMinutes = mins(current.time);
  const maxDate = addScheduleDays(current.date, daysAhead);
  const candidates = new Map<string, ScheduleCandidate>();

  // -1 captura corretamente a cauda após meia-noite da janela do dia anterior.
  for (let offset = -1; offset < daysAhead; offset += 1) {
    const sourceDate = addScheduleDays(current.date, offset);
    const window = effectiveWindow(store, sourceDate);
    if (!window) continue;

    let start = mins(window.open);
    let end = mins(window.close);
    if (end <= start) end += 1440;

    const first = Math.ceil(start / config.intervalMinutes) * config.intervalMinutes;

    for (let minute = first; minute < end; minute += config.intervalMinutes) {
      const slotDate = minute >= 1440 ? addScheduleDays(sourceDate, Math.floor(minute / 1440)) : sourceDate;
      if (slotDate < current.date || slotDate >= maxDate) continue;

      const time = hhmm(minute % 1440);

      if (config.enabledTimes.length && !config.enabledTimes.includes(time)) continue;

      const deltaMinutes =
        dayDistance(current.date, slotDate) * 1440 +
        mins(time) -
        currentMinutes;

      if (deltaMinutes < config.leadMinutes) continue;

      const slotException = store.exceptions.find((item) => item.date === slotDate);
      if (slotException?.closed) continue;

      const value = `${slotDate}T${time}:00-03:00`;
      candidates.set(value, { value, date: slotDate, time });
    }
  }

  return [...candidates.values()].sort((a,b) => a.value.localeCompare(b.value));
}

export function isScheduledValueAllowed(
  scheduledFor: string,
  config: SchedulePolicyConfig,
  store: SchedulePolicyStore,
  now = new Date(),
  daysAhead = 7,
) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-03:00$/.test(scheduledFor)) return false;
  return buildOrderScheduleCandidates(config, store, now, daysAhead)
    .some((slot) => slot.value === scheduledFor);
}
