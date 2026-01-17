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

  // 1. SETUP DO ÁUDIO (USANDO SOM DO SISTEMA - NOTIFICAÇÃO CURTA)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Link direto de uma notificação oficial do Google (ultra leve e compatível)
      const audio = new Audio("https://fonts.gstatic.com/s/i/productlogos/googleg/v6/web-24dp/logo_googleg_color_24dp.png"); // Placeholder para teste de canal
      // Som de notificação limpo e de alta compatibilidade
      audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0; // Força volume máximo no player
    }

    const liberarSom = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          window.removeEventListener("mousedown", liberarSom);
          window.removeEventListener("touchstart", liberarSom);
        }).catch(() => {});
      }
    };
    window.addEventListener("mousedown", liberarSom);
    window.addEventListener("touchstart", liberarSom);
  }, []);

  // 2. ESCUTA EM TEMPO REAL (SEM CACHE)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Criamos a query com limite para ser rápida
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"), limit(25));

    // O segredo para não precisar de F5 é o includeMetadataChanges
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        // Pequeno delay para garantir que o navegador processou a chegada do dado
        setTimeout(() => {
          audioRef.current?.play().catch(e => console.warn("Erro ao tocar:", e));
        }, 500);
      } else if (!temPendentes) {
        setAlarmeAtivo(false);
        silenciadoPeloUsuario.current = false;
        audioRef.current?.pause();
      }

      setPedidos(docs);
      setLoading(false);
    }, (error) => {
      console.error("Erro Firebase:", error);
    });

    return () => unsubscribe();
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
