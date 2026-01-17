"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { normalizarStatus } from "@/lib/orderUtils";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenciadoPeloUsuario = useRef(false);

  // 1. Setup do Áudio (Ding Dong)
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

  // 2. Escuta Blindada (Sem OrderBy para evitar erro de índice)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) {
      setLoading(false);
      return;
    }

    // Buscamos a coleção pura. Se houver algo lá, vai aparecer.
    const colRef = collection(db, "Pedidos");

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      console.log("🔥 Snapshot recebido:", snapshot.size, "pedidos");
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Ordenamos manualmente aqui no celular (Mais seguro)
      const docsOrdenados = docs.sort((a, b) => {
        const dataA = a.data?.seconds ? a.data.seconds * 1000 : new Date(a.data).getTime();
        const dataB = b.data?.seconds ? b.data.seconds * 1000 : new Date(b.data).getTime();
        return (dataB || 0) - (dataA || 0);
      });

      const temPendentes = docsOrdenados.some(p => normalizarStatus(p.status) === "Pendente");

      // Lógica do Som
      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        audioRef.current?.play().catch(() => {});
      } else if (!temPendentes) {
        setAlarmeAtivo(false);
        silenciadoPeloUsuario.current = false;
        audioRef.current?.pause();
      }

      setPedidos(docsOrdenados);
      setLoading(false);
    }, (error) => {
      console.error("❌ Erro Crítico Firebase:", error);
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
