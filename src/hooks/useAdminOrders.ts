"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { normalizarStatus } from "@/lib/orderUtils";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  
  const prevPedidosCount = useRef(0);
  const isFirstLoad = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // PREPARA O ÁUDIO ASSIM QUE O HOOK CARREGA
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.loop = true;
      audioRef.current = audio;
    }
  }, []);

  const controlarAlarme = (ligar: boolean) => {
    if (!audioRef.current) return;

    if (ligar) {
      console.log("🔔 Tentando tocar alarme...");
      setAlarmeAtivo(true);
      audioRef.current.play().catch((err) => {
        console.warn("⚠️ Som bloqueado pelo navegador. Clique na página para liberar.", err);
      });
    } else {
      console.log("🔕 Desligando alarme.");
      setAlarmeAtivo(false);
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const novosPendentes = docs.filter((p: any) => normalizarStatus(p.status) === "Pendente").length;

      console.log(`📊 Pedidos Pendentes: ${novosPendentes} | Anterior: ${prevPedidosCount.current}`);

      // LOGICA CORRIGIDA: Se aumentou o número de pendentes, toca.
      if (!isFirstLoad.current && novosPendentes > prevPedidosCount.current) {
        controlarAlarme(true);
      }
      
      // Se zerou os pendentes, para o som.
      if (novosPendentes === 0) {
        controlarAlarme(false);
      }

      prevPedidosCount.current = novosPendentes;
      isFirstLoad.current = false;
      setPedidos(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, admins]);

  return { pedidos, loading, alarmeAtivo, pararAlarme: () => controlarAlarme(false) };
}
