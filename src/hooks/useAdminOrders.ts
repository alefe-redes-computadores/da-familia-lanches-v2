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

  // 1. SETUP DO ÁUDIO (Versão Máxima Compatibilidade)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Som de alerta clássico, curto e alto
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
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

  // 2. ESCUTA EM TEMPO REAL
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        if (audioRef.current) {
          // O SEGREDO: Força o recarregamento do som antes de dar play
          audioRef.current.load(); 
          audioRef.current.play().catch(e => console.log("Erro som:", e));
        }
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
