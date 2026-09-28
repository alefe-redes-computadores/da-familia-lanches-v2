"use client";

import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";
import type { AdminOrder } from "@/lib/adminOrders";
import { recordFirestoreReadEstimate } from "@/lib/firestoreReadBudget";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const authoritativeOrdersRef = useRef<Map<string, AdminOrder>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || audioRef.current) return;
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
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

    initializedRef.current = false;
    knownIdsRef.current = new Set();
    authoritativeOrdersRef.current = new Map();

    let cancelled = false;

    const loadAuthoritativeOrders = async () => {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/admin/orders", {
          method: "GET",
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
        };

        if (cancelled || !payload.ok || !Array.isArray(payload.orders)) return;

        const docs = payload.orders;
        const pendingIds = docs
          .filter((order) => normalizarStatus(order.status) === "Pendente")
          .map((order) => String(order.id));

        knownIdsRef.current = new Set(pendingIds);
        initializedRef.current = true;

        authoritativeOrdersRef.current = new Map(
          docs.map((order) => [String(order.id), order]),
        );

        setPedidos(docs);
        setLoading(false);

        console.info("[admin-orders] authority", {
          serverCount: docs.length,
        });
      } catch (error) {
        console.error("[admin/orders] bootstrap autoritativo falhou:", error);
      }
    };

    void loadAuthoritativeOrders();

    const ACTIVE_STATUSES = [
      "Pendente",
      "Em Produção",
      "Agendado",
      "Pronto",
      "Saiu para entrega",
      "Em rota",
    ] as const;

    const realtimeByStatus = new Map<string, Map<string, AdminOrder>>();
    const unsubscribers: Array<() => void> = [];

    const publishMergedOrders = () => {
      const merged = new Map(authoritativeOrdersRef.current);

      for (const docs of realtimeByStatus.values()) {
        for (const [id, order] of docs) {
          merged.set(id, order);
        }
      }

      const next = [...merged.values()]
        .sort((a, b) => {
          const av = new Date(String(a.data ?? "")).getTime() || 0;
          const bv = new Date(String(b.data ?? "")).getTime() || 0;
          return bv - av;
        })
        .slice(0, 120);

      setPedidos(next);
    };

    for (const status of ACTIVE_STATUSES) {
      const activeQuery = query(
        collection(db, "Pedidos"),
        where("status", "==", status),
        limit(40),
      );

      const unsubscribe = onSnapshot(
        activeQuery,
        (snapshot) => {
          const docs = new Map<string, AdminOrder>();

          for (const doc of snapshot.docs) {
            docs.set(doc.id, {
              id: doc.id,
              ...(doc.data() as Omit<AdminOrder, "id">),
            });
          }

          realtimeByStatus.set(status, docs);

          // Remove da autoridade qualquer versão antiga dos mesmos IDs
          // antes de publicar a versão realtime.
          for (const id of docs.keys()) {
            authoritativeOrdersRef.current.delete(id);
          }

          publishMergedOrders();
        },
        (error) => {
          console.error(`[admin/orders] realtime ${status}`, error);
        },
      );

      unsubscribers.push(unsubscribe);
    }

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [currentUser, admins]);





  return {
    pedidos,
    loading,
    alarmeAtivo,
    pararAlarme: () => {
      setAlarmeAtivo(false);
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    },
  };
}
