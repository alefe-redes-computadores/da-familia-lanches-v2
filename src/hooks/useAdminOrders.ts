"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { normalizarStatus } from "@/lib/orderUtils";

export function useAdminOrders(currentUser: any, admins: string[]) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenciadoPeloUsuario = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // SOM NOVO: Mais alto e persistente (Campainha de Loja Forte)
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2256/2256-preview.mp3");
      audio.loop = true;
      audio.volume = 1.0; 
      audioRef.current = audio;

      const desbloquear = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            window.removeEventListener("click", desbloquear);
            window.removeEventListener("touchstart", desbloquear);
          }).catch(() => {});
        }
      };
      window.addEventListener("click", desbloquear);
      window.addEventListener("touchstart", desbloquear);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      // LÓGICA DE PERSISTÊNCIA: 
      // O som só liga se houver pendentes e não tiver sido silenciado manualmente.
      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        audioRef.current?.play().catch(() => {});
      } else if (!temPendentes) {
        // Quando os pendentes somem (ex: aceitou todos), resetamos tudo.
        setAlarmeAtivo(false);
        silenciadoPeloUsuario.current = false;
        audioRef.current?.pause();
      }

      setPedidos(docs);
      setLoading(false);
    }, (error) => {
      console.error("Erro Firebase:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  return { 
    pedidos, 
    loading, 
    alarmeAtivo, 
    // Função para silenciar manualmente via botão
    pararAlarme: () => {
      silenciadoPeloUsuario.current = true;
      setAlarmeAtivo(false);
      audioRef.current?.pause();
    } 
  };
}
