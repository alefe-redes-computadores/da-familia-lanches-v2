"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";

type Summary = {
  total: number;
  completed: number;
  cancelled: number;
  initialized: boolean;
  loading: boolean;
  error: string;
};

type SharedEntry = {
  summary: Summary;
  loadedAt: number;
  inflight: Promise<void> | null;
  listeners: Set<(summary: Summary) => void>;
};

const CACHE_MS = 5 * 60 * 1000;

const empty: Summary = {
  total: 0,
  completed: 0,
  cancelled: 0,
  initialized: false,
  loading: false,
  error: "",
};

const entries = new Map<string, SharedEntry>();

function entryFor(uid: string): SharedEntry {
  let entry = entries.get(uid);

  if (!entry) {
    entry = {
      summary: { ...empty, loading: true },
      loadedAt: 0,
      inflight: null,
      listeners: new Set(),
    };
    entries.set(uid, entry);
  }

  return entry;
}

function emit(entry: SharedEntry) {
  entry.listeners.forEach((listener) => listener(entry.summary));
}

async function readSummaryDocument(uid: string) {
  const snapshot = await getDoc(doc(db, "Usuarios", uid, "Loyalty", "state"));
  const data = snapshot.data() ?? {};

  return {
    total: Math.max(0, Number(data.totalOrders) || 0),
    completed: Math.max(0, Number(data.completedOrders) || 0),
    cancelled: Math.max(0, Number(data.cancelledOrders) || 0),
    initialized: data.initialized === true,
    loading: false,
    error: "",
  } satisfies Summary;
}

async function loadSummary(
  user: NonNullable<ReturnType<typeof useAuthStore.getState>["currentUser"]>,
  force = false,
) {
  const uid = user.uid;
  const entry = entryFor(uid);

  if (!force && entry.loadedAt && Date.now() - entry.loadedAt < CACHE_MS) {
    return;
  }

  if (entry.inflight) return entry.inflight;

  entry.summary = { ...entry.summary, loading: true, error: "" };
  emit(entry);

  entry.inflight = (async () => {
    try {
      /*
       * O endpoint só executa as aggregations na primeira inicialização.
       * Depois disso ele custa apenas a leitura do documento Loyalty/state.
       *
       * A chamada é compartilhada em nível de módulo, portanto Cart,
       * Rewards e insights não disparam backfills concorrentes.
       */
      const token = await user.getIdToken();
      const response = await fetch("/api/customer/order-summary", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!response.ok) throw new Error("SUMMARY_FAILED");

      entry.summary = await readSummaryDocument(uid);
      entry.loadedAt = Date.now();
      emit(entry);
    } catch (reason) {
      console.error(reason);
      entry.summary = {
        ...entry.summary,
        loading: false,
        error: "Não foi possível carregar seu resumo agora.",
      };
      emit(entry);
    } finally {
      entry.inflight = null;
    }
  })();

  return entry.inflight;
}

function invalidate(uid: string) {
  const entry = entries.get(uid);
  if (entry) entry.loadedAt = 0;
}

export function useCustomerOrderStats() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const { activeOrders } = useCustomerOrders(currentUser);

  const [summary, setSummary] = useState<Summary>(() =>
    currentUser ? entryFor(currentUser.uid).summary : empty,
  );

  useEffect(() => {
    if (!currentUser) {
      setSummary(empty);
      return;
    }

    const user = currentUser;
    const entry = entryFor(user.uid);

    entry.listeners.add(setSummary);
    setSummary(entry.summary);
    void loadSummary(user);

    const refresh = () => {
      invalidate(user.uid);
      void loadSummary(user, true);
    };

    window.addEventListener("dfl:customer-order-terminal", refresh);

    return () => {
      entry.listeners.delete(setSummary);
      window.removeEventListener("dfl:customer-order-terminal", refresh);
    };
  }, [currentUser?.uid]);

  return useMemo(
    () => ({
      total: summary.total,
      completed: summary.completed,
      cancelled: summary.cancelled,
      active: activeOrders.length,
      loading: summary.loading,
      error: summary.error,
      initialized: summary.initialized,
    }),
    [summary, activeOrders.length],
  );
}
