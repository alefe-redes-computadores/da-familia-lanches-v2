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

  // 1. SETUP DO ÁUDIO (SOM TURBO)
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      // Usando um som de alarme industrial mais encorpado e alto
      const audio = new Audio("https://raw.githubusercontent.com/rafael-claudio/sonoplastia/main/alarm.mp3");
      audio.loop = true;
      audio.volume = 1.0; // Volume máximo no player
      audioRef.current = audio;

      const desbloquear = () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current?.pause();
            // Garante que o volume está no topo após o desbloqueio
            audioRef.current!.volume = 1.0; 
            window.removeEventListener("click", desbloquear);
            window.removeEventListener("touchstart", desbloquear);
          }).catch(() => {});
        }
      };
      window.addEventListener("click", desbloquear);
      window.addEventListener("touchstart", desbloquear);
    }
  }, []);

  // 2. ESCUTA EM TEMPO REAL (MANTIDA A LÓGICA QUE FUNCIONOU)
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    // Consulta total sem limit para a contagem de concluídos não bugar
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const temPendentes = docs.some(p => normalizarStatus(p.status) === "Pendente");

      if (temPendentes && !silenciadoPeloUsuario.current) {
        setAlarmeAtivo(true);
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
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
  }, [currentUser]); // Dependência mínima para não dar delay

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
