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

type AdminAlarmCandidate = {
  id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function alarmCandidate(order: AdminOrder): AdminAlarmCandidate {
  const id = String(order.id);
  return {
    id,
    title: "Novo pedido na cozinha",
    body: `${String(
      order.userName ||
      order.clienteNome ||
      order.nomeCliente ||
      "Cliente",
    )} - pedido #${id.slice(-8).toUpperCase()}`,
    url: `/admin?stage=cozinha&order=${encodeURIComponent(id)}`,
    tag: `new-order-${id}`,
  };
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
  const alertedPendingIdsRef = useRef<Set<string>>(new Set());
  const acknowledgedPendingIdsRef = useRef<Set<string>>(new Set());
  const knownActiveStatusRef = useRef<Map<string, string>>(new Map());
  const authoritativeOrdersRef =
    useRef<Map<string, AdminOrder>>(new Map());
  const realtimeOrdersRef =
    useRef<Map<string, AdminOrder>>(new Map());
  const historyCursorRef = useRef<string | null>(null);
  const historyCatalogRef = useRef<AdminOrder[]>([]);
  const historyVisibleRef = useRef(20);
  const historyBusyRef = useRef(false);
  const cancelledRef = useRef(false);

  const silenceAlarm = useCallback(() => {
    setAlarmeAtivo(false);
    const target = audioRef.current;
    target?.pause();
    if (target) target.currentTime = 0;
  }, []);

  const raiseAdminAlarm = useCallback((candidates: AdminAlarmCandidate[]) => {
    const fresh = candidates.filter((candidate) => {
      const id = candidate.id.trim();
      return Boolean(id) &&
        !acknowledgedPendingIdsRef.current.has(id) &&
        !alertedPendingIdsRef.current.has(id);
    });
    if (!fresh.length) return;

    for (const candidate of fresh) {
      alertedPendingIdsRef.current.add(candidate.id);
    }
    setAlarmeAtivo(true);

    void (async () => {
      let audible = false;
      const target = audioRef.current;
      if (target) {
        try {
          target.currentTime = 0;
          await target.play();
          audible = true;
        } catch (error) {
          console.warn("[admin/orders] áudio local bloqueado; usando fallback do sistema", error);
        }
      }
      if (!audible) navigator.vibrate?.([220,100,220,100,320]);

      for (const candidate of fresh) {
        window.dispatchEvent(new CustomEvent("dfl:admin-alert", {
          detail: {
            id: candidate.id,
            title: candidate.title,
            body: candidate.body,
            url: candidate.url ?? `/admin?stage=cozinha&order=${encodeURIComponent(candidate.id)}`,
            tag: candidate.tag ?? `new-order-${candidate.id}`,
            forceVisible: !audible,
          },
        }));
      }
    })();
  }, []);

  const reconhecerPedido = useCallback((id: string) => {
    const cleanId = String(id).trim();
    if (!cleanId) return;
    acknowledgedPendingIdsRef.current.add(cleanId);
    alertedPendingIdsRef.current.add(cleanId);

    const remaining = [
      ...realtimeOrdersRef.current.values(),
      ...authoritativeOrdersRef.current.values(),
    ].some((order) => {
      const orderId = String(order.id);
      return orderId !== cleanId &&
        normalizarStatus(order.status) === "Pendente" &&
        !acknowledgedPendingIdsRef.current.has(orderId);
    });

    if (!remaining) silenceAlarm();
  }, [silenceAlarm]);

  const desfazerReconhecimentoPedido = useCallback((id: string) => {
    const cleanId = String(id).trim();
    if (!cleanId) return;
    acknowledgedPendingIdsRef.current.delete(cleanId);
    alertedPendingIdsRef.current.delete(cleanId);

    const order =
      realtimeOrdersRef.current.get(cleanId) ??
      authoritativeOrdersRef.current.get(cleanId);

    if (order && normalizarStatus(order.status) === "Pendente") {
      raiseAdminAlarm([alarmCandidate(order)]);
    }
  }, [raiseAdminAlarm]);

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

    const audio = new Audio("/notification-default.wav");

    audio.loop = true;
    audio.volume = 1;
    audio.preload = "auto";
    audio.load();
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
    alertedPendingIdsRef.current = new Set();
    acknowledgedPendingIdsRef.current = new Set();
    knownActiveStatusRef.current = new Map();
    authoritativeOrdersRef.current = new Map();
    realtimeOrdersRef.current = new Map();
    historyCursorRef.current = null;
    historyCatalogRef.current = [];
    historyVisibleRef.current = 20;
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
          historyCatalog?: AdminOrder[];
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

        if (Array.isArray(payload.historyCatalog)) {
          historyCatalogRef.current=payload.historyCatalog;
          historyVisibleRef.current=Math.min(20,payload.historyCatalog.length);
          setHistoryHasMore(historyVisibleRef.current<payload.historyCatalog.length);
        } else setHistoryHasMore(payload.historyHasMore===true);

        knownActiveStatusRef.current = new Map(
          payload.orders
            .filter((order) => ACTIVE_CANONICAL.has(normalizarStatus(order.status)))
            .map((order) => [String(order.id), normalizarStatus(order.status)]),
        );

        raiseAdminAlarm(
          payload.orders
            .filter((order) => normalizarStatus(order.status) === "Pendente")
            .map(alarmCandidate),
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

        const pendingOrders =
          [...realtime.values()].filter(
            (order) => normalizarStatus(order.status) === "Pendente",
          );

        raiseAdminAlarm(pendingOrders.map(alarmCandidate));

        if (initializedRef.current) {
          for (const order of realtime.values()) {
            const id = String(order.id);
            const nextStatus = normalizarStatus(order.status);
            const previousStatus = knownActiveStatusRef.current.get(id);
            if (nextStatus === "Pronto" && previousStatus && previousStatus !== "Pronto") {
              window.dispatchEvent(new CustomEvent("dfl:admin-alert", {
                detail: {
                  id,
                  title: "Pedido pronto para sair",
                  body: `${String(order.clienteNome || order.nomeCliente || "Cliente")} · confira na Expedição`,
                  url: `/admin?stage=expedicao&order=${encodeURIComponent(id)}`,
                  tag: `ready-${id}`,
                },
              }));
            }
          }
        }

        window.dispatchEvent(new CustomEvent("dfl:admin-badge", {
          detail: {
            count: [...realtime.values()].filter((order) =>
              ["Pendente", "Pronto"].includes(normalizarStatus(order.status)),
            ).length,
          },
        }));

        knownActiveStatusRef.current = new Map(
          [...realtime.values()].map((order) => [
            String(order.id),
            normalizarStatus(order.status),
          ]),
        );
        initializedRef.current = true;

        publish();
        setLoading(false);
      },
      (error) => {
        console.error("[admin/orders] realtime ativo", error);
      },
    );

    const onForegroundPush = (event: Event) => {
      const detail = (event as CustomEvent<{
        type?: string;
        orderId?: string;
        title?: string;
        body?: string;
        tag?: string;
        url?: string;
      }>).detail;

      if (detail?.type !== "admin.new_order" || !detail.orderId) return;

      raiseAdminAlarm([{
        id: detail.orderId,
        title: detail.title ?? "Novo pedido na cozinha",
        body: detail.body ?? `Pedido #${detail.orderId.slice(-8).toUpperCase()}`,
        tag: detail.tag ?? `new-order-${detail.orderId}`,
        url: detail.url ?? `/admin?stage=cozinha&order=${encodeURIComponent(detail.orderId)}`,
      }]);
    };

    window.addEventListener("dfl:admin-push-foreground", onForegroundPush);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener("dfl:admin-push-foreground", onForegroundPush);
      unsubscribe();
    };
  }, [currentUser, admins, publish, raiseAdminAlarm]);

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
        historyCatalog?: AdminOrder[];
      };
      if (cancelledRef.current || !payload.ok || !Array.isArray(payload.orders)) return;

      for (const [id, order] of authoritativeOrdersRef.current) {
        const status = normalizarStatus(order.status);
        if (status === "Finalizado" || status === "Cancelado") authoritativeOrdersRef.current.delete(id);
      }
      const catalog=Array.isArray(payload.historyCatalog)?payload.historyCatalog:payload.orders;
      historyCatalogRef.current=catalog;
      historyVisibleRef.current=Math.min(20,catalog.length);
      for (const order of catalog.slice(0,historyVisibleRef.current))
        authoritativeOrdersRef.current.set(String(order.id),order);

      historyCursorRef.current = typeof payload.historyCursor === "string" ? payload.historyCursor : null;
      setHistoryHasMore(historyVisibleRef.current<catalog.length);
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
    if (historyBusyRef.current || !historyHasMore || cancelledRef.current) return;
    historyBusyRef.current=true;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const catalog=historyCatalogRef.current;
      const from=historyVisibleRef.current;
      const to=Math.min(from+20,catalog.length);
      for (const order of catalog.slice(from,to))
        authoritativeOrdersRef.current.set(String(order.id),order);
      historyVisibleRef.current=to;
      setHistoryHasMore(to<catalog.length);
      publish();
    } catch(error) {
      console.error("[admin/orders] histórico local:",error);
      setHistoryError("Não foi possível abrir os próximos pedidos.");
    } finally {
      historyBusyRef.current=false;
      if(!cancelledRef.current)setHistoryLoading(false);
    }
  },[historyHasMore,publish]);

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
    pararAlarme: silenceAlarm,
    reconhecerPedido,
    desfazerReconhecimentoPedido,
  };
}
