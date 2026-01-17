"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { updateDoc, doc, increment, onSnapshot, writeBatch } from "firebase/firestore";
import { useAuthStore } from "@/store/auth.store";
import { useAdminOrders } from "@/hooks/useAdminOrders";

// Importações dos arquivos fatiados
import { OrderCard } from "@/components/layout/OrderCard";
import { LogisticaModal } from "@/components/layout/LogisticaModal";
import { FinanceiroDashboard } from "@/components/layout/FinanceiroDashboard";
import { normalizarStatus, avisarWhatsApp } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";

export default function AdminPage() {
  const { currentUser } = useAuthStore();
  const admins = ["alefejohsefe@gmail.com", "kalebhstanley650@gmail.com", "contato@dafamilialanches.com.br"];
  
  const { pedidos, loading, alarmeAtivo, pararAlarme } = useAdminOrders(currentUser, admins);
  
  const [tab, setTab] = useState<"cozinha" | "expedicao" | "concluidos" | "motoboy">("cozinha");
  const [storeOpen, setStoreOpen] = useState(true);
  const [dadosRodrigo, setDadosRodrigo] = useState<any>(null);
  const [modalLogistica, setModalLogistica] = useState({ isOpen: false, pedidoId: "", pedidoData: null as any });

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;
    const unsubLoja = onSnapshot(doc(db, "settings", "loja"), (snap) => snap.exists() && setStoreOpen(snap.data().isOpen));
    const unsubRodrigo = onSnapshot(doc(db, "Entregadores", "rodrigo"), (snap) => snap.exists() && setDadosRodrigo(snap.data()));
    return () => { unsubLoja(); unsubRodrigo(); };
  }, [currentUser, admins]);

  // FUNÇÃO PARA ZERAR O TURNO
  const handleRegistrarPagamento = async (valor: number) => {
    if (!confirm(`Confirmar encerramento de turno? Saldo de R$ ${valor.toFixed(2)} será zerado.`)) return;
    try {
      const batch = writeBatch(db);
      const rodrigoRef = doc(db, "Entregadores", "rodrigo");
      batch.update(rodrigoRef, { totalEntregas: 0, saldoAcumulado: 0 });
      await batch.commit();
      alert("Turno zerado com sucesso!");
    } catch (e) {
      alert("Erro ao zerar turno.");
    }
  };

  const updateStatus = async (id: string, newStatus: string, pedido?: any) => {
    pararAlarme();
    if (newStatus === "Saiu para Entrega" && pedido?.tipoEntrega !== "pickup") {
      setModalLogistica({ isOpen: true, pedidoId: id, pedidoData: pedido });
      return;
    }
    try {
      await updateDoc(doc(db, "Pedidos", id), { status: newStatus });
      if (["Pronto", "Saiu para Entrega"].includes(newStatus)) {
        avisarWhatsApp(pedido?.userPhone || pedido?.phone, pedido?.userName, newStatus);
      }
    } catch (e) { alert("Erro ao atualizar status"); }
  };

  const confirmarDespacho = async (motoboy: "rodrigo" | "avulso") => {
    const { pedidoId, pedidoData } = modalLogistica;
    if (!pedidoId) return;
    try {
      const pedidoRef = doc(db, "Pedidos", pedidoId);
      await updateDoc(pedidoRef, { 
        status: "Saiu para Entrega", 
        entregador: motoboy
      });

      // Apenas incrementamos a contagem. O saldo agora é manual no Dashboard.
      if (motoboy === "rodrigo") {
        await updateDoc(doc(db, "Entregadores", "rodrigo"), { totalEntregas: increment(1) });
      }

      const tel = pedidoData?.userPhone || pedidoData?.phone;
      if (tel) avisarWhatsApp(tel, pedidoData?.userName, "Saiu para Entrega");
      
      setModalLogistica({ isOpen: false, pedidoId: "", pedidoData: null });
    } catch (e) { 
      console.error(e);
      alert("Erro ao despachar pedido."); 
    }
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const s = normalizarStatus(p.status);
    if (tab === "cozinha") return s === "Pendente" || s === "Em Produção";
    if (tab === "expedicao") return s === "Pronto" || s === "Saiu para Entrega";
    if (tab === "concluidos") return s === "Finalizado";
    return false;
  });

  if (!currentUser || !admins.includes(currentUser.email!)) return <h1 style={{textAlign: "center", marginTop: "100px"}}>Acesso Negado 🔐</h1>;
  if (loading) return <h2 style={{textAlign: "center", marginTop: "100px"}}>Carregando Monitor... 📟</h2>;

  return (
    <div style={{ padding: "15px", maxWidth: "1400px", margin: "85px auto 0 auto", minHeight: "100vh" }} onClick={pararAlarme}>
      <LogisticaModal 
        isOpen={modalLogistica.isOpen} 
        onClose={() => setModalLogistica({...modalLogistica, isOpen: false})} 
        onConfirm={confirmarDespacho} 
      />
      
      {alarmeAtivo && (
        <div style={{ background: "#d32f2f", color: "#fff", padding: "15px", textAlign: "center", borderRadius: "12px", marginBottom: "20px", fontWeight: "900", cursor: "pointer", animation: "pulse 1.5s infinite" }}>
          🚨 NOVO PEDIDO! CLIQUE PARA SILENCIAR 🚨
        </div>
      )}

      <header style={{ marginBottom: "25px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0 }}>📟 Monitor Família</h1>
          <button onClick={() => updateDoc(doc(db, "settings", "loja"), { isOpen: !storeOpen })} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", fontWeight: "bold", background: storeOpen ? "#4caf50" : "#f44336", color: "#fff", cursor: "pointer" }}>
            {storeOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
          </button>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "20px", overflowX: "auto", paddingBottom: "10px" }}>
          {["cozinha", "expedicao", "concluidos", "motoboy"].map((t: any) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: "1", minWidth: "100px", padding: "12px", borderRadius: "12px", border: "none", background: tab === t ? "#111" : "#eee", color: tab === t ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}>
              {t === "cozinha" ? "🔥 COZINHA" : t === "expedicao" ? "🛵 ENTREGA" : t === "concluidos" ? "✅ FIM" : "👤 RODRIGO"}
            </button>
          ))}
        </div>
      </header>

      {tab === "motoboy" ? (
        dadosRodrigo && <FinanceiroDashboard dados={dadosRodrigo} onRegistrarPagamento={handleRegistrarPagamento} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {pedidosFiltrados.length === 0 ? (
            <p style={{ textAlign: "center", gridColumn: "1/-1", color: "#999", padding: "50px" }}>Nenhum pedido nesta aba.</p>
          ) : (
            pedidosFiltrados.map(p => <OrderCard key={p.id} pedido={p} updateStatus={updateStatus} imprimirPedido={imprimirPedido} />)
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}