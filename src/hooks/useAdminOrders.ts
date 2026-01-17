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
  const unsubscribeRef = useRef<any>(null);

  // 1. SETUP DO ÁUDIO
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2256/2256-preview.mp3");
      audio.loop = true;
      audioRef.current = audio;

      const unlock = () => {
        audioRef.current?.play().then(() => {
          audioRef.current?.pause();
          window.removeEventListener("click", unlock);
        }).catch(() => {});
      };
      window.addEventListener("click", unlock);
    }
  }, []);

  // 2. CONEXÃO FORÇADA
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    console.log("🛠️ Tentando abrir canal de pedidos...");

    const q = query(
      collection(db, "Pedidos"), 
      orderBy("data", "desc"), 
      limit(30)
    );

    // Limpa conexão anterior se existir
    if (unsubscribeRef.current) unsubscribeRef.current();

    unsubscribeRef.current = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      // Se chegamos aqui, a conexão está ativa!
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        audioRef.current?.play().catch(e => console.log("Erro audio:", e));
      } else if (!temPendentes) {
        setAlarmeAtivo(false);
        silenciadoPeloUsuario.current = false;
        audioRef.current?.pause();
      }

      setPedidos(docs);
      setLoading(false);
    }, (error) => {
      console.error("❌ Falha total na escuta:", error);
      // Se falhar, força um recarregamento do hook em 5s
      setTimeout(() => setLoading(true), 5000);
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [currentUser]); // Removido 'admins' para evitar loops de re-render

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
