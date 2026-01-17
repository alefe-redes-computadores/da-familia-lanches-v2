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

  // 1. Setup do Áudio
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2256/2256-preview.mp3");
      audio.loop = true;
      audioRef.current = audio;

      const unlock = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            window.removeEventListener("click", unlock);
          }).catch(() => {});
        }
      };
      window.addEventListener("click", unlock);
    }
  }, []);

  // 2. ESCUTA BLINDADA (Foco em Tempo Real)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Query simples e direta
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"), limit(30));

    // snapshotListenOptions com includeMetadataChanges garante que o Firebase
    // nos avise no exato segundo que o servidor recebeu o pedido
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      
      // Se a mudança veio do servidor ou é uma mudança local imediata
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      // Gerenciamento de Som (sem travar o estado)
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
    });

    return () => unsubscribe();
  }, [currentUser, admins]); // SEM alarmeAtivo aqui para não resetar a conexão!

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
