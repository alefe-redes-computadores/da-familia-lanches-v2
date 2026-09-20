"use client";

import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";
import type { AdminOrder } from "@/lib/adminOrders";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

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
    const ordersQuery = query(
      collection(db, "Pedidos"),
      orderBy("data", "desc"),
      limit(120),
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const docs = snapshot.docs.map((document): AdminOrder => ({ id: document.id, ...document.data() } as AdminOrder));
      const pendingIds = docs
        .filter((order) => normalizarStatus(order.status) === "Pendente")
        .map((order) => String(order.id));
      const pendingSet = new Set(pendingIds);
      const hasNewPending = initializedRef.current && pendingIds.some((id) => !knownIdsRef.current.has(id));

      if (hasNewPending) {
        setAlarmeAtivo(true);
        audioRef.current?.play().catch(() => undefined);
      } else if (!pendingIds.length) {
        setAlarmeAtivo(false);
        audioRef.current?.pause();
      }

      knownIdsRef.current = pendingSet;
      initializedRef.current = true;
      setPedidos(docs);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao acompanhar pedidos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
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
