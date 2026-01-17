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

  // 1. INICIALIZAÇÃO DO ÁUDIO COM DESBLOQUEIO
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Usando um link de áudio do GitHub que é mais estável para evitar erros de carregamento
      const audio = new Audio("https://raw.githubusercontent.com/rafael-claudio/sonoplastia/main/alarm.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;

      // Função para o navegador permitir o som após o primeiro clique do usuário na tela
      const desbloquearAudio = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            window.removeEventListener("click", desbloquearAudio);
            console.log("🔊 Canal de áudio liberado pelo navegador");
          }).catch(() => {});
        }
      };
      window.addEventListener("click", desbloquearAudio);
    }
  }, []);

  const controlarAlarme = (ligar: boolean) => {
    if (!audioRef.current) return;
    if (ligar && !alarmeSilenciadoManualmente.current) {
      setAlarmeAtivo(true);
      // Tenta tocar; se falhar (por falta de clique), o navegador avisará no console
      audioRef.current.play().catch((e) => console.warn("Aguardando clique para tocar som...", e));
    } else if (!ligar) {
      setAlarmeAtivo(false);
      audioRef.current.pause();
    }
  };

  // 2. BUSCA DE DADOS (CONSULTA PURA PARA NÃO BUGAR)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const colRef = collection(db, "Pedidos");
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      console.log("🔥 Snapshot recebido! Pedidos encontrados:", snapshot.size);
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Ordenação manual: do mais novo para o mais antigo
      const docsOrdenados = docs.sort((a, b) => {
        const dataA = a.data?.seconds ? a.data.seconds * 1000 : new Date(a.data).getTime();
        const dataB = b.data?.seconds ? b.data.seconds * 1000 : new Date(b.data).getTime();
        return (dataB || 0) - (dataA || 0);
      });

      // Se houver qualquer pedido "Pendente", o som deve tocar
      const temPendentes = docs.some((p: any) => normalizarStatus(p.status) === "Pendente");

      if (temPendentes) {
        controlarAlarme(true);
      } else {
        // Quando limpa a cozinha, reseta o silêncio manual para o próximo pedido
        alarmeSilenciadoManualmente.current = false;
        controlarAlarme(false);
      }

      setPedidos(docsOrdenados);
      setLoading(false);
    }, (error) => {
      console.error("❌ ERRO NO FIREBASE:", error);
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
