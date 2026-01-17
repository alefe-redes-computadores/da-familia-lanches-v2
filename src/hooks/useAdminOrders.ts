"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { normalizarStatus } from "@/lib/orderUtils";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstLoad = useRef(true);

  // 1. Inicialização do Áudio com "Keep-Alive" para evitar bloqueio do navegador
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;

      // Toca um micro-silêncio a cada 25s para o navegador não "matar" o processo de áudio da aba
      const interval = setInterval(() => {
        if (!alarmeAtivo && audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
          audioRef.current.volume = 1;
        }
      }, 25000);
      return () => clearInterval(interval);
    }
  }, [alarmeAtivo]);

  const controlarAlarme = (ligar: boolean) => {
    if (!audioRef.current) return;
    if (ligar) {
      setAlarmeAtivo(true);
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.warn("Navegador bloqueou o autoplay. O som tocará após o primeiro clique na tela.", err);
      });
    } else {
      setAlarmeAtivo(false);
      audioRef.current.pause();
    }
  };

  // 2. Escuta do Firebase em Tempo Real (Otimizada)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Buscamos os 50 mais recentes para garantir performance
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"), limit(50));
    
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // LÓGICA DE SOM PERSISTENTE:
      // Filtramos se existe qualquer pedido com status "Pendente"
      const temPendentes = docs.some((p: any) => normalizarStatus(p.status) === "Pendente");

      // Se houver pendentes e o alarme estiver desligado, ligue-o (mesmo após recarregar a página)
      if (temPendentes && !alarmeAtivo) {
        controlarAlarme(true);
      }
      
      // Se não houver mais nenhum pendente (todos foram aceitos ou cancelados), desliga o som
      if (!temPendentes && alarmeAtivo) {
        controlarAlarme(false);
      }

      setPedidos(docs);
      setLoading(false);
      isFirstLoad.current = false;
    });

    return () => unsubscribe();
  }, [currentUser, admins, alarmeAtivo]); 

  // Função para silenciar manualmente (pararAlarme) será enviada no retorno
  return { 
    pedidos, 
    loading, 
    alarmeAtivo, 
    pararAlarme: () => controlarAlarme(false) 
  };
}
