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

  // 1. SETUP DO ÁUDIO (MÁXIMA CONFIANÇA)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Som de Alarme do Google (Super compatível e audível)
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
      audio.loop = true;
      audio.volume = 1.0;
      audio.preload = "auto"; // Força o carregamento imediato
      audioRef.current = audio;

      const desbloquear = () => {
        if (audioRef.current) {
          // Tenta um play/pause rápido para "acordar" o canal de áudio
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            console.log("🔊 Sistema de som pronto e liberado");
            window.removeEventListener("click", desbloquear);
            window.removeEventListener("touchstart", desbloquear);
          }).catch((err) => console.error("Erro ao liberar som:", err));
        }
      };
      window.addEventListener("click", desbloquear);
      window.addEventListener("touchstart", desbloquear);
    }
  }, []);

  // 2. ESCUTA EM TEMPO REAL (MANTIDA A VERSÃO QUE VOCÊ GOSTOU)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        if (audioRef.current) {
          // Força o volume e tenta tocar
          audioRef.current.volume = 1.0;
          audioRef.current.play().catch(e => console.warn("Aguardando interação para tocar:", e));
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
