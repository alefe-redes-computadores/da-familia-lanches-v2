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
  const silenciadoPeloUsuario = useRef(false);
  // Ref para controlar a conexão e evitar que ela morra
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 1. SETUP DO ÁUDIO (Ding Dong Profissional)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2256/2256-preview.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;

      const unlock = () => {
        audioRef.current?.play().then(() => {
          audioRef.current?.pause();
          window.removeEventListener("click", unlock);
        }).catch(() => {});
      };
      window.addEventListener("click", unlock);
    }
  }, []);

  // 2. FUNÇÃO DE CONEXÃO (Acelerada)
  const conectarMonitor = () => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Se já existe uma conexão, mata ela antes de criar outra para não duplicar
    if (unsubscribeRef.current) unsubscribeRef.current();

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"), limit(40));

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      console.log("⚡ Pedidos atualizados via Tempo Real");
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        audioRef.current?.play().catch(() => {});
      } else if (!temPendentes) {
        setAlarmeAtivo(false);
        silenciadoPeloUsuario.current = false;
        audioRef.current?.pause();
      }

      setPedidos(docs);
      setLoading(false);
    }, (error) => {
      console.error("Erro na conexão:", error);
      // Se der erro, tenta reconectar em 5 segundos
      setTimeout(conectarMonitor, 5000);
    });
  };

  useEffect(() => {
    conectarMonitor();
    
    // 3. WAKE-UP (Impede o navegador de dormir)
    // A cada 1 minuto, ele dá uma "cutucada" na conexão se o monitor estiver vazio
    const keepAlive = setInterval(() => {
      if (pedidos.length === 0) conectarMonitor();
    }, 60000);

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      clearInterval(keepAlive);
    };
  }, [currentUser]);

  return { 
    pedidos, 
    loading, 
    alarmeAtivo, 
    pararAlarme: () => {
      silenciadoPeloUsuario.current = true;
      setAlarmeAtivo(false);
      audioRef.current?.pause();
    } 
  };
}
