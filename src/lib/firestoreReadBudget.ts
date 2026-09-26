"use client";

export type FirestoreBudgetEntry = {
  source: string;
  documents: number;
  events: number;
  lastAt: number;
};

export type FirestoreBudgetSnapshot = {
  totalDocuments: number;
  totalEvents: number;
  startedAt: number;
  entries: FirestoreBudgetEntry[];
};

const KEY = "dfl:firestore-budget:v1";
const EVENT = "dfl:firestore-budget";

function empty(): FirestoreBudgetSnapshot {
  return { totalDocuments: 0, totalEvents: 0, startedAt: Date.now(), entries: [] };
}

export function readFirestoreBudget(): FirestoreBudgetSnapshot {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as FirestoreBudgetSnapshot;
    return {
      totalDocuments: Math.max(0, Number(parsed.totalDocuments) || 0),
      totalEvents: Math.max(0, Number(parsed.totalEvents) || 0),
      startedAt: Math.max(0, Number(parsed.startedAt) || Date.now()),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return empty();
  }
}

export function recordFirestoreReadEstimate(source: string, documents: number) {
  if (typeof window === "undefined") return;
  const count = Math.max(0, Math.floor(Number(documents) || 0));
  const snapshot = readFirestoreBudget();
  const existing = snapshot.entries.find((entry) => entry.source === source);
  if (existing) {
    existing.documents += count;
    existing.events += 1;
    existing.lastAt = Date.now();
  } else {
    snapshot.entries.push({ source, documents: count, events: 1, lastAt: Date.now() });
  }
  snapshot.totalDocuments += count;
  snapshot.totalEvents += 1;
  snapshot.entries.sort((a, b) => b.documents - a.documents);
  try { window.sessionStorage.setItem(KEY, JSON.stringify(snapshot)); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: snapshot }));
  if (snapshot.totalDocuments >= 500 && snapshot.totalDocuments - count < 500) {
    console.warn("[firestore-budget] sessão acima de 500 documentos estimados", snapshot);
  }
}

export function subscribeFirestoreBudget(listener: (snapshot: FirestoreBudgetSnapshot) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<FirestoreBudgetSnapshot>).detail ?? readFirestoreBudget());
  window.addEventListener(EVENT, handler);
  listener(readFirestoreBudget());
  return () => window.removeEventListener(EVENT, handler);
}

export function resetFirestoreBudget() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: empty() }));
}
