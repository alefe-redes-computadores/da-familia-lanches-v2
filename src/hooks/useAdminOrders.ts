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

  const controlarAlarme = (ligar: boolean) => {
    if (ligar) {
      setAlarmeAtivo(true);
      if (!audioRef.current) {
        audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => console.log("Aguardando interação..."));
    } else {
      setAlarmeAtivo(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const novosPendentes = docs.filter((p: any) => normalizarStatus(p.status) === "Pendente").length;

      // Se entrou pedido novo, liga o som
      if (!isFirstLoad.current && novosPendentes > prevPedidosCount.current) {
        controlarAlarme(true);
      }
      
      // Se não tem nenhum pendente, desliga o som obrigatoriamente
      if (novosPendentes === 0) {
        setAlarmeAtivo(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
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
