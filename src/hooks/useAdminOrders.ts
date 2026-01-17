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
  const isFirstLoad = useRef(true);

  // 1. INICIALIZAÇÃO DO SISTEMA DE ÁUDIO
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Usando o som padrão de notificação (mais leve e compatível)
      const audio = new Audio("https://www.gstatic.com/chat/sounds/new_message.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;

      // Desbloqueio do canal de áudio pelo primeiro clique do usuário
      const unlockAudio = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            window.removeEventListener("click", unlockAudio);
            console.log("Canal de áudio liberado");
          }).catch(() => {});
        }
      };
      window.addEventListener("click", unlockAudio);
    }
  }, []);

  // 2. FUNÇÃO CONTROLADORA DO ALARME
  const controlarAlarme = (ligar: boolean) => {
    if (!audioRef.current) return;
    if (ligar) {
      if (silenciadoPeloUsuario.current) return;
      setAlarmeAtivo(true);
      audioRef.current.play().catch((e) => console.log("Aguardando interação...", e));
    } else {
      setAlarmeAtivo(false);
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // 3. ESCUTA EM TEMPO REAL (SEM NECESSIDADE DE F5)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Query otimizada para o Firebase entregar o pedido instantaneamente
    const q = query(
      collection(db, "Pedidos"), 
      orderBy("data", "desc"), 
      limit(50)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Verifica se existe qualquer pedido pendente
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      // Lógica de som: Se tem pendente, liga. Se não tem, desliga e reseta o silêncio manual.
      if (temPendentes) {
        controlarAlarme(true);
      } else {
        silenciadoPeloUsuario.current = false;
        controlarAlarme(false);
      }

      setPedidos(docs);
      setLoading(false);
      isFirstLoad.current = false;
    }, (error) => {
      console.error("Erro no monitoramento:", error);
      // Fallback em caso de erro na query
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, admins]); // Mantemos dependências mínimas para evitar loops e delays

  // 4. RETORNO DAS FUNÇÕES PARA O COMPONENTE ADMIN
  return { 
    pedidos, 
    loading, 
    alarmeAtivo, 
    pararAlarme: () => {
      silenciadoPeloUsuario.current = true; // Impede o som de voltar até o próximo ciclo
      controlarAlarme(false);
    } 
  };
}