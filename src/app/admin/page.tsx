"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, doc, writeBatch
} from "firebase/firestore";
import { useAuthStore } from "@/store/auth.store";

// Importações dos arquivos que você criou/fatiou
import { OrderCard } from "@/components/layout/OrderCard";
import { formatarData, normalizarStatus, avisarWhatsApp } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";

export default function AdminPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [tab, setTab] = useState<"cozinha" | "expedicao" | "concluidos" | "motoboy">("cozinha");
  const { currentUser } = useAuthStore();
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  // Estados do Rodrigo (Motoboy)
  const [dadosRodrigo, setDadosRodrigo] = useState<any>(null);

  const prevPedidosCount = useRef(0);
  const isFirstLoad = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const admins = [
    "alefejohsefe@gmail.com",
    "kalebhstanley650@gmail.com",
    "contato@dafamilialanches.com.br"
  ];

  // --- LÓGICA DO ALARME (RECUPERADA) ---
  const controlarAlarme = (ligar: boolean) => {
    if (ligar) {
      setAlarmeAtivo(true);
      if (!audioRef.current) {
        audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audioRef.current.loop = true; // <--- ISSO FAZ REPETIR SEM PARAR
      }
      audioRef.current.play().catch(() => console.log("Aguardando interação..."));
    } else {
      setAlarmeAtivo(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  // --- BUSCA DADOS DO RODRIGO ---
  useEffect(() => {
    if (tab === "motoboy") {
      const unsub = onSnapshot(doc(db, "Entregadores", "rodrigo"), (snap) => {
        if (snap.exists()) setDadosRodrigo(snap.data());
      });
      return () => unsub();
    }
  }, [tab]);

  // --- MONITOR DE PEDIDOS (REAL-TIME) ---
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;
    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const novosPendentes = docs.filter((p: any) => normalizarStatus(p.status) === "Pendente").length;

      // Lógica do som de novo pedido
      if (!isFirstLoad.current && novosPendentes > prevPedidosCount.current) {
        controlarAlarme(true);
      }
      if (novosPendentes === 0) setAlarmeAtivo(false);

      prevPedidosCount.current = novosPendentes;
      isFirstLoad.current = false;
      setPedidos(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // --- CONTROLE DA LOJA ---
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;
    return onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) setStoreOpen(snap.data().isOpen);
    });
  }, [currentUser]);

  const toggleStore = async () => {
    try {
      await updateDoc(doc(db, "settings", "loja"), { isOpen: !storeOpen });
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (id: string, newStatus: string, pedido?: any) => {
    try {
      await updateDoc(doc(db, "Pedidos", id), { status: newStatus });
      if (newStatus === "Pronto" && pedido?.tipoEntrega === "pickup") {
        avisarWhatsApp(pedido.userPhone || pedido.phone, pedido.userName, "Pronto");
      } else if (newStatus === "Saiu para Entrega") {
        avisarWhatsApp(pedido.userPhone || pedido.phone, pedido.userName, "Saiu para Entrega");
      }
    } catch (e) { alert("Erro ao atualizar status"); }
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const s = normalizarStatus(p.status);
    if (tab === "cozinha") return s === "Pendente" || s === "Em Produção";
    if (tab === "expedicao") return s === "Pronto" || s === "Saiu para Entrega";
    if (tab === "concluidos") return s === "Finalizado";
    return false;
  });

  if (!currentUser || !admins.includes(currentUser.email!)) {
    return <div style={{ textAlign: "center", marginTop: "100px" }}><h1>Acesso Negado 🔐</h1></div>;
  }

  if (loading) return <div style={{ textAlign: "center", marginTop: "100px" }}><h2>Carregando Monitor... 📟</h2></div>;

  return (
    <div
      style={{ padding: "15px", maxWidth: "1400px", margin: "85px auto 0 auto", fontFamily: "sans-serif", backgroundColor: "#fcfcfc", minHeight: "100vh" }}
      onClick={() => alarmeAtivo && controlarAlarme(false)} // Para o alarme ao clicar na tela
    >
      {/* ALERTA VISUAL DE NOVO PEDIDO */}
      {alarmeAtivo && (
        <div style={{ background: "#d32f2f", color: "#fff", padding: "15px", textAlign: "center", borderRadius: "12px", marginBottom: "20px", fontWeight: "900", animation: "pulse 1.5s infinite" }}>
          🚨 NOVO PEDIDO PENDENTE! CLIQUE PARA PARAR O SOM 🚨
        </div>
      )}

      <header style={{ marginBottom: "25px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0 }}>📟 Monitor Família</h1>
          <button onClick={toggleStore} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", fontWeight: "bold", background: storeOpen ? "#4caf50" : "#f44336", color: "#fff", cursor: "pointer" }}>
            {storeOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS DINÂMICA */}
        <div style={{ display: "flex", background: "#f0f0f0", padding: "6px", borderRadius: "16px", marginTop: "20px", overflowX: "auto", gap: "8px", scrollbarWidth: "none" }}>
          <button 
            onClick={() => setTab("cozinha")}
            style={{ flex: "1", minWidth: "fit-content", padding: "12px 18px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "cozinha" ? "#111" : "transparent", color: tab === "cozinha" ? "#fff" : "#666", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            🔥 COZINHA 
            <span style={{ background: tab === "cozinha" ? "#ffca28" : "#ddd", color: "#111", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>
              {pedidos.filter(p => ["Pendente", "Em Produção"].includes(normalizarStatus(p.status))).length}
            </span>
          </button>

          <button 
            onClick={() => setTab("expedicao")}
            style={{ flex: "1", minWidth: "fit-content", padding: "12px 18px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "expedicao" ? "#2196f3" : "transparent", color: tab === "expedicao" ? "#fff" : "#666", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            🛵 ENTREGA
            <span style={{ background: tab === "expedicao" ? "#fff" : "#ddd", color: "#111", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>
              {pedidos.filter(p => ["Pronto", "Saiu para Entrega"].includes(normalizarStatus(p.status))).length}
            </span>
          </button>

          <button 
            onClick={() => setTab("concluidos")}
            style={{ flex: "1", minWidth: "fit-content", padding: "12px 18px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "concluidos" ? "#4caf50" : "transparent", color: tab === "concluidos" ? "#fff" : "#666", fontWeight: "bold" }}
          >
            ✅ FIM
          </button>

          <button 
            onClick={() => setTab("motoboy")}
            style={{ flex: "1", minWidth: "fit-content", padding: "12px 18px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "motoboy" ? "#673ab7" : "transparent", color: tab === "motoboy" ? "#fff" : "#666", fontWeight: "bold" }}
          >
            👤 RODRIGO
          </button>
        </div>
      </header>

      {/* ABA MOTOBOY */}
      {tab === "motoboy" && (
        <div style={{ background: "#fff", padding: "20px", borderRadius: "15px", border: "1px solid #eee" }}>
          <h2 style={{ margin: "0 0 5px 0" }}>🛵 Painel do Rodrigo</h2>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}>Taxa base atual: R$ {dadosRodrigo?.taxaBase?.toFixed(2) || "0,00"}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div style={{ background: "#f1f8e9", padding: "20px", borderRadius: "12px", border: "1px solid #c5e1a5" }}>
              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#558b2f", textTransform: "uppercase" }}>Saldo a Pagar</span>
              <h3 style={{ margin: "10px 0", fontSize: "28px", fontWeight: "900" }}>
                R$ {dadosRodrigo?.saldoAcumulado ? dadosRodrigo.saldoAcumulado.toFixed(2) : "0,00"}
              </h3>
            </div>

            <div style={{ background: "#e3f2fd", padding: "20px", borderRadius: "12px", border: "1px solid #bbdefb" }}>
              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#1976d2", textTransform: "uppercase" }}>Total de Entregas</span>
              <h3 style={{ margin: "10px 0", fontSize: "28px", fontWeight: "900" }}>
                {dadosRodrigo?.totalEntregas || 0}
              </h3>
            </div>
          </div>

          <button
            onClick={() => alert("Em breve: Gerar relatório e zerar saldo")}
            style={{
              width: "100%", marginTop: "20px", padding: "16px", borderRadius: "12px",
              background: "#111", color: "#fff", fontWeight: "bold", border: "none", cursor: "pointer"
            }}
          >
            Fechar Dia / Realizar Pagamento
          </button>
        </div>
      )}

      {/* LISTAGEM DE PEDIDOS */}
      {tab !== "motoboy" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {pedidosFiltrados.length === 0 ? (
            <p style={{ textAlign: "center", gridColumn: "1/-1", padding: "50px", color: "#999" }}>Nenhum pedido aqui.</p>
          ) : (
            pedidosFiltrados.map(pedido => (
              <OrderCard
                key={pedido.id}
                pedido={pedido}
                updateStatus={updateStatus}
                imprimirPedido={imprimirPedido}
              />
            ))
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}