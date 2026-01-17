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
  const alarmeSilenciadoManualmente = useRef(false);

  // Inicializa áudio
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.loop = true;
      audioRef.current = audio;
    }
  }, []);

  const controlarAlarme = (ligar: boolean) => {
    if (!audioRef.current) return;
    if (ligar && !alarmeSilenciadoManualmente.current) {
      setAlarmeAtivo(true);
      audioRef.current.play().catch(() => {});
    } else if (!ligar) {
      setAlarmeAtivo(false);
      audioRef.current.pause();
    }
  };

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // CONSULTA PURA: Sem orderBy, sem limit, sem filtros. 
    // Se houver algo no banco, ISSO VAI PUXAR.
    const colRef = collection(db, "Pedidos");
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      console.log("🔥 Snapshot recebido! Documentos:", snapshot.size);
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Ordenação manual robusta por data (do mais novo para o mais antigo)
      const docsOrdenados = docs.sort((a, b) => {
        const dataA = a.data?.seconds ? a.data.seconds * 1000 : new Date(a.data).getTime();
        const dataB = b.data?.seconds ? b.data.seconds * 1000 : new Date(b.data).getTime();
        return (dataB || 0) - (dataA || 0);
      });

      // Lógica de Alarme baseada no estado real do banco
      const temPendentes = docs.some((p: any) => normalizarStatus(p.status) === "Pendente");

      if (temPendentes) {
        controlarAlarme(true);
      } else {
        alarmeSilenciadoManualmente.current = false;
        controlarAlarme(false);
      }

      setPedidos(docsOrdenados);
      setLoading(false);
    }, (error) => {
      console.error("❌ ERRO CRÍTICO NO FIREBASE:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, admins]);

  return { 
    pedidos, 
    loading, 
    alarmeAtivo, 
    pararAlarme: () => {
      alarmeSilenciadoManualmente.current = true;
      controlarAlarme(false);
    } 
  };
}
