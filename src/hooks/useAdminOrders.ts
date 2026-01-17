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

  // 1. Inicializa o áudio (Ding Dong)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2256/2256-preview.mp3");
      audioRef.current.loop = true;

      const liberarAudio = () => {
        audioRef.current?.play().then(() => {
          audioRef.current?.pause();
          window.removeEventListener("click", liberarAudio);
        }).catch(() => {});
      };
      window.addEventListener("click", liberarAudio);
    }
  }, []);

  // 2. Escuta do Firebase (A mais simples e direta possível)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) {
      setLoading(false);
      return;
    }

    // Criamos a consulta
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"), limit(40));

    // Abrimos o canal de tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      // Lógica do Som
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
      console.error("Erro no Firebase:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, admins]);

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
