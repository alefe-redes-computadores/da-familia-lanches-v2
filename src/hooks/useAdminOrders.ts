"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, limit, orderBy } from "firebase/firestore";
import { normalizarStatus } from "@/lib/orderUtils";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmeSilenciadoManualmente = useRef(false);

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
      if (alarmeSilenciadoManualmente.current) return; // Se o usuário já clicou para silenciar, não religa sozinho
      setAlarmeAtivo(true);
      audioRef.current.play().catch(() => console.log("Aguardando interação para som..."));
    } else {
      setAlarmeAtivo(false);
      audioRef.current.pause();
    }
  };

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Query simplificada: Se o orderBy estiver bugando, ele remove o pedido da lista. 
    // Vamos usar apenas a coleção pura para garantir que os pedidos APAREÇAM.
    const q = query(collection(db, "Pedidos"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Ordenação manual no JavaScript (mais seguro que no Firebase se os índices estiverem ruins)
      const docsOrdenados = docs.sort((a, b) => {
        const dataA = a.data?.seconds ? a.data.seconds : new Date(a.data).getTime();
        const dataB = b.data?.seconds ? b.data.seconds : new Date(b.data).getTime();
        return dataB - dataA;
      });

      const temPendentes = docsOrdenados.some((p: any) => normalizarStatus(p.status) === "Pendente");

      // Lógica do Som
      if (temPendentes) {
        controlarAlarme(true);
      } else {
        alarmeSilenciadoManualmente.current = false; // Reseta o silêncio quando limpa a cozinha
        controlarAlarme(false);
      }

      setPedidos(docsOrdenados);
      setLoading(false);
    }, (error) => {
      console.error("Erro no Firebase Snapshot:", error);
      alert("Erro ao carregar pedidos. Verifique o console.");
    });

    return () => unsubscribe();
  }, [currentUser, admins]);

  return { 
    pedidos, 
    loading, 
    alarmeAtivo, 
    pararAlarme: () => {
      alarmeSilenciadoManualmente.current = true;
      controlarAlarme(false);
    } 
  };
}
