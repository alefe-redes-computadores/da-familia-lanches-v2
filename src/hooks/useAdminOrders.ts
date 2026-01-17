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

  // 1. INICIALIZAÇÃO COM MULTI-SINAL
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Link direto de um som de notificação padrão do Android (muito estável)
      const audio = new Audio("https://www.gstatic.com/chat/sounds/new_message.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;

      // Desbloqueio obrigatório por clique
      const liberarSom = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            window.removeEventListener("click", liberarSom);
            console.log("Som Liberado!");
          }).catch(() => {});
        }
      };
      window.addEventListener("click", liberarSom);
    }
  }, []);

  const controlarAlarme = (ligar: boolean) => {
    if (!audioRef.current) return;
    
    if (ligar && !alarmeSilenciadoManualmente.current) {
      setAlarmeAtivo(true);
      // Tenta tocar o áudio
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // PLANO B: Se o áudio falhar, tenta um "Beep" de sistema a cada 2s
          if (!alarmeSilenciadoManualmente.current) {
             console.log("Tentando Beep de emergência...");
             const context = new (window.AudioContext || (window as any).webkitAudioContext)();
             const osc = context.createOscillator();
             osc.type = "sine";
             osc.connect(context.destination);
             osc.start();
             osc.stop(context.currentTime + 0.2);
          }
        });
      }
    } else if (!ligar) {
      setAlarmeAtivo(false);
      audioRef.current.pause();
    }
  };

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const unsubscribe = onSnapshot(collection(db, "Pedidos"), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const docsOrdenados = docs.sort((a, b) => {
        const dataA = a.data?.seconds ? a.data.seconds * 1000 : new Date(a.data).getTime();
        const dataB = b.data?.seconds ? b.data.seconds * 1000 : new Date(b.data).getTime();
        return (dataB || 0) - (dataA || 0);
      });

      const temPendentes = docs.some((p: any) => normalizarStatus(p.status) === "Pendente");

      if (temPendentes) {
        controlarAlarme(true);
      } else {
        alarmeSilenciadoManualmente.current = false;
        controlarAlarme(false);
      }

      setPedidos(docsOrdenados);
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
