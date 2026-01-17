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

  // 1. SETUP DO ÁUDIO (Formatos de alta compatibilidade)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Som de notificação padrão do Google - Curto e nítido
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.loop = true;
      audio.volume = 1.0;
      audioRef.current = audio;

      // Desbloqueio para Firefox e Chrome Mobile
      const desbloquear = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            window.removeEventListener("click", desbloquear);
            window.removeEventListener("touchstart", desbloquear);
            console.log("Som liberado");
          }).catch(() => {});
        }
      };
      window.addEventListener("click", desbloquear);
      window.addEventListener("touchstart", desbloquear);
    }
  }, []);

  // 2. ESCUTA TOTAL E INSTANTÂNEA
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // REMOVEMOS O LIMIT: Agora ele lê todos para a contagem de gestão ficar certa
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      // O 'fromCache' nos avisa se o dado é velho ou novo
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
      console.error("Erro Firebase:", error);
      setLoading(false);
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
