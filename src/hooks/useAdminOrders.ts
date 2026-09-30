"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";
import { orderDateToMillis } from "@/lib/orderCompat";
import { orderHistoryTimestamp, type AdminOrder } from "@/lib/adminOrders";
import { recordFirestoreReadEstimate } from "@/lib/firestoreReadBudget";

const ACTIVE_QUERY_STATUSES = [
  "Pendente",
  "Em Produção",
  "Agendado",
  "Pronto",
  "Saiu para Entrega",
  "Saiu para entrega",
  "Em rota",
] as const;

const ACTIVE_CANONICAL = new Set([
  "Pendente",
  "Em Produção",
  "Agendado",
  "Pronto",
  "Saiu para Entrega",
]);

function orderMillis(order: AdminOrder) {
  const status = normalizarStatus(order.status);
  if (status === "Finalizado" || status === "Cancelado") {
    return orderHistoryTimestamp(order);
  }
  return orderDateToMillis(order.statusUpdatedAt) ||
    orderDateToMillis(order.data) ||
    orderDateToMillis(order.createdAt);
}

function newestFirst(a: AdminOrder, b: AdminOrder) {
  return orderMillis(b) - orderMillis(a) ||
    String(b.id).localeCompare(String(a.id));
}

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearchLoading, setHistorySearchLoading] = useState(false);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);
  const knownPendingIdsRef = useRef<Set<string>>(new Set());
  const authoritativeOrdersRef =
    useRef<Map<string, AdminOrder>>(new Map());
  const realtimeOrdersRef =
    useRef<Map<string, AdminOrder>>(new Map());
  const historyCursorRef = useRef<string | null>(null);
  const historyBusyRef = useRef(false);
  const cancelledRef = useRef(false);

  const publish = useCallback(() => {
    const merged = new Map(authoritativeOrdersRef.current);

    /*
     * Versões realtime sempre vencem a autoridade bootstrap
     * para pedidos ainda operacionais.
     */
    for (const [id, order] of realtimeOrdersRef.current) {
      merged.set(id, order);
    }

    const active: AdminOrder[] = [];
    const history: AdminOrder[] = [];

    for (const order of merged.values()) {
      if (ACTIVE_CANONICAL.has(normalizarStatus(order.status))) {
        active.push(order);
      } else {
        history.push(order);
      }
    }

    active.sort(newestFirst);
    history.sort(newestFirst);

    setPedidos([...active, ...history]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || audioRef.current) return;

    const audio =
      new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");

    audio.loop = true;
    audio.volume = 1;
    audio.preload = "auto";
    audioRef.current = audio;

    const unlock = () => {
      const target = audioRef.current;
      if (!target) return;

      void target.play().then(() => {
        target.pause();
        target.currentTime = 0;
        window.removeEventListener("click", unlock);
        window.removeEventListener("touchstart", unlock);
      }).catch(() => undefined);
    };

    window.addEventListener("click", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });

    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    const email = currentUser?.email;

    if (!email || !admins.includes(email)) {
      setLoading(false);
      return;
    }

    cancelledRef.current = false;
    initializedRef.current = false;
    knownPendingIdsRef.current = new Set();
    authoritativeOrdersRef.current = new Map();
    realtimeOrdersRef.current = new Map();
    historyCursorRef.current = null;
    setHistoryHasMore(false);
    setLoading(true);

    const bootstrap = async () => {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/admin/orders", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`ADMIN_ORDERS_HTTP_${response.status}`);
        }

        const payload = await response.json() as {
          ok?: boolean;
          orders?: AdminOrder[];
          historyCursor?: string | null;
          historyHasMore?: boolean;
        };

        if (
          cancelledRef.current ||
          !payload.ok ||
          !Array.isArray(payload.orders)
        ) return;

        authoritativeOrdersRef.current = new Map(
          payload.orders.map((order) => [String(order.id), order]),
        );

        historyCursorRef.current =
          typeof payload.historyCursor === "string"
            ? payload.historyCursor
            : null;

        setHistoryHasMore(payload.historyHasMore === true);

        knownPendingIdsRef.current = new Set(
          payload.orders
            .filter(
              (order) =>
                normalizarStatus(order.status) === "Pendente",
            )
            .map((order) => String(order.id)),
        );

        initializedRef.current = true;
        publish();
        setLoading(false);
      } catch (error) {
        console.error(
          "[admin/orders] bootstrap autoritativo falhou:",
          error,
        );

        if (!cancelledRef.current) setLoading(false);
      }
    };

    void bootstrap();

    /*
     * Um único listener para toda a fila operacional.
     * Sem orderBy: não depende de índice composto.
     * Ordenação acontece em memória.
     */
    const activeQuery = query(
      collection(db, "Pedidos"),
      where("status", "in", [...ACTIVE_QUERY_STATUSES]),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      activeQuery,
      (snapshot) => {
        recordFirestoreReadEstimate(
          "admin.orders.active",
          snapshot.size,
        );

        const realtime = new Map<string, AdminOrder>();

        for (const doc of snapshot.docs) {
          realtime.set(doc.id, {
            id: doc.id,
            ...(doc.data() as Omit<AdminOrder, "id">),
          });
        }

        /*
         * Remove versões ativas antigas do bootstrap. Se um pedido
         * saiu da fila ativa, o snapshot é a autoridade dessa fila.
         */
        for (const [id, order] of authoritativeOrdersRef.current) {
          if (ACTIVE_CANONICAL.has(normalizarStatus(order.status))) {
            authoritativeOrdersRef.current.delete(id);
          }
        }

        realtimeOrdersRef.current = realtime;

        const pendingIds = new Set(
          [...realtime.values()]
            .filter(
              (order) =>
                normalizarStatus(order.status) === "Pendente",
            )
            .map((order) => String(order.id)),
        );

        if (initializedRef.current) {
          const hasNewPending =
            [...pendingIds].some(
              (id) => !knownPendingIdsRef.current.has(id),
            );

          if (hasNewPending) {
            setAlarmeAtivo(true);
            void audioRef.current?.play().catch(() => undefined);
          }
        }

        knownPendingIdsRef.current = pendingIds;
        initializedRef.current = true;

        publish();
        setLoading(false);
      },
      (error) => {
        console.error("[admin/orders] realtime ativo", error);
      },
    );

    return () => {
      cancelledRef.current = true;
      unsubscribe();
    };
  }, [currentUser, admins, publish]);

  const refreshHistory = useCallback(async () => {
    if (!currentUser || cancelledRef.current || historyBusyRef.current) return;
    historyBusyRef.current = true;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/orders?mode=history", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`ADMIN_HISTORY_REFRESH_HTTP_${response.status}`);
      const payload = await response.json() as {
        ok?: boolean;
        orders?: AdminOrder[];
        historyCursor?: string | null;
        historyHasMore?: boolean;
      };
      if (cancelledRef.current || !payload.ok || !Array.isArray(payload.orders)) return;

      for (const [id, order] of authoritativeOrdersRef.current) {
        const status = normalizarStatus(order.status);
        if (status === "Finalizado" || status === "Cancelado") authoritativeOrdersRef.current.delete(id);
      }
      for (const order of payload.orders) authoritativeOrdersRef.current.set(String(order.id), order);

      historyCursorRef.current = typeof payload.historyCursor === "string" ? payload.historyCursor : null;
      setHistoryHasMore(payload.historyHasMore === true);
      publish();
    } catch (error) {
      console.error("[admin/orders] refresh histórico:", error);
      setHistoryError("Não foi possível carregar o histórico.");
    } finally {
      historyBusyRef.current = false;
      if (!cancelledRef.current) setHistoryLoading(false);
    }
  }, [currentUser, publish]);

  const loadMoreHistory = useCallback(async () => {
    if (
      historyBusyRef.current ||
      !historyHasMore ||
      !currentUser ||
      cancelledRef.current
    ) return;

    historyBusyRef.current = true;
    setHistoryError(null);
    setHistoryLoading(true);

    try {
      const token = await currentUser.getIdToken();
      const cursor = historyCursorRef.current;

      const params = new URLSearchParams({ mode: "history" });
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(
        `/api/admin/orders?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`ADMIN_HISTORY_HTTP_${response.status}`);
      }

      const payload = await response.json() as {
        ok?: boolean;
        orders?: AdminOrder[];
        historyCursor?: string | null;
        historyHasMore?: boolean;
      };

      if (
        cancelledRef.current ||
        !payload.ok ||
        !Array.isArray(payload.orders)
      ) return;

      for (const order of payload.orders) {
        authoritativeOrdersRef.current.set(
          String(order.id),
          order,
        );
      }

      historyCursorRef.current =
        typeof payload.historyCursor === "string"
          ? payload.historyCursor
          : null;

      setHistoryHasMore(payload.historyHasMore === true);
      publish();
    } catch (error) {
      console.error("[admin/orders] histórico:", error);
      setHistoryError("Não foi possível carregar pedidos mais antigos.");
    } finally {
      historyBusyRef.current = false;
      if (!cancelledRef.current) setHistoryLoading(false);
    }
  }, [
    currentUser,
    historyHasMore,
    historyLoading,
    publish,
  ]);

  const searchHistoryIdentifier = useCallback(async (term: string) => {
    const clean=term.trim(); if(!clean||!currentUser||cancelledRef.current)return;
    setHistorySearchLoading(true);
    try {
      const token=await currentUser.getIdToken();
      const params=new URLSearchParams({mode:"search",q:clean});
      const response=await fetch(`/api/admin/orders?${params.toString()}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      if(!response.ok) throw new Error(`ADMIN_HISTORY_SEARCH_HTTP_${response.status}`);
      const payload=await response.json() as {ok?:boolean;orders?:AdminOrder[]};
      if(cancelledRef.current||!payload.ok||!Array.isArray(payload.orders))return;
      for(const order of payload.orders) authoritativeOrdersRef.current.set(String(order.id),order);
      publish();
    } catch(error){console.error("[admin/orders] busca histórica:",error)}
    finally{if(!cancelledRef.current)setHistorySearchLoading(false)}
  },[currentUser,publish]);

  return {
    pedidos,
    loading,
    historyLoading,
    historyHasMore,
    historyError,
    historySearchLoading,
    refreshHistory,
    loadMoreHistory,
    searchHistoryIdentifier,
    alarmeAtivo,
    pararAlarme: () => {
      setAlarmeAtivo(false);
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    },
  };
}
