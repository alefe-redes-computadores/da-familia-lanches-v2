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
import { RelatoriosAdmin } from "@/components/layout/RelatoriosAdmin";
import { normalizarStatus, avisarWhatsApp } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";

export default function AdminPage() {
  const { currentUser } = useAuthStore();
  const admins = ["alefejohsefe@gmail.com", "kalebhstanley650@gmail.com", "contato@dafamilialanches.com.br"];
  
  const { pedidos, loading, alarmeAtivo, pararAlarme } = useAdminOrders(currentUser, admins);
  
  const [tab, setTab] = useState<"cozinha" | "expedicao" | "concluidos" | "gestao">("cozinha");
  const [storeOpen, setStoreOpen] = useState(true);
  const [dadosRodrigo, setDadosRodrigo] = useState<any>(null);
  const [modalLogistica, setModalLogistica] = useState({ isOpen: false, pedidoId: "", pedidoData: null as any });

  // --- CONTAGEM DINÂMICA ---
  const countCozinha = pedidos.filter(p => ["Pendente", "Em Produção"].includes(normalizarStatus(p.status))).length;
  const countExpedicao = pedidos.filter(p => ["Pronto", "Saiu para Entrega"].includes(normalizarStatus(p.status))).length;
  const countConcluidos = pedidos.filter(p => normalizarStatus(p.status) === "Finalizado").length;

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;
    const unsubLoja = onSnapshot(doc(db, "settings", "loja"), (snap) => snap.exists() && setStoreOpen(snap.data().isOpen));
    const unsubRodrigo = onSnapshot(doc(db, "Entregadores", "rodrigo"), (snap) => snap.exists() && setDadosRodrigo(snap.data()));
    return () => { unsubLoja(); unsubRodrigo(); };
  }, [currentUser, admins]);

  const handleRegistrarPagamento = async (valor: number) => {
    if (!confirm(`Confirmar encerramento de turno? Saldo de R$ ${valor.toFixed(2)} será zerado.`)) return;
    try {
      const batch = writeBatch(db);
      const rodrigoRef = doc(db, "Entregadores", "rodrigo");
      batch.update(rodrigoRef, { totalEntregas: 0, saldoAcumulado: 0 });
      await batch.commit();
      alert("Turno zerado com sucesso!");
    } catch (e) { alert("Erro ao zerar turno."); }
  };

  const updateStatus = async (id: string, newStatus: string, pedido?: any) => {
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
      await updateDoc(pedidoRef, { status: "Saiu para Entrega", entregador: motoboy });
      if (motoboy === "rodrigo") {
        await updateDoc(doc(db, "Entregadores", "rodrigo"), { totalEntregas: increment(1) });
      }
      const tel = pedidoData?.userPhone || pedidoData?.phone;
      if (tel) avisarWhatsApp(tel, pedidoData?.userName, "Saiu para Entrega");
      
      // FECHAR MODAL
      setModalLogistica({ isOpen: false, pedidoId: "", pedidoData: null });
    } catch (e) { alert("Erro ao despachar pedido."); }
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
    <div style={{ padding: "15px", maxWidth: "1400px", margin: "85px auto 0 auto", minHeight: "100vh" }}>
      <LogisticaModal 
        isOpen={modalLogistica.isOpen} 
        onClose={() => setModalLogistica({isOpen: false, pedidoId: "", pedidoData: null})} 
        onConfirm={confirmarDespacho} 
      />
      
      {alarmeAtivo && (
        <div 
          onClick={pararAlarme}
          style={{ background: "#d32f2f", color: "#fff", padding: "15px", textAlign: "center", borderRadius: "12px", marginBottom: "20px", fontWeight: "900", cursor: "pointer", animation: "pulse 1.5s infinite" }}
        >
          🚨 NOVO PEDIDO! CLIQUE AQUI PARA SILENCIAR 🚨
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
          <button onClick={() => setTab("cozinha")} style={{ flex: "1", minWidth: "110px", padding: "12px", borderRadius: "12px", border: "none", background: tab === "cozinha" ? "#111" : "#eee", color: tab === "cozinha" ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}>
            🔥 COZINHA {countCozinha > 0 && `(${countCozinha})`}
          </button>
          <button onClick={() => setTab("expedicao")} style={{ flex: "1", minWidth: "110px", padding: "12px", borderRadius: "12px", border: "none", background: tab === "expedicao" ? "#111" : "#eee", color: tab === "expedicao" ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}>
            🛵 ENTREGA {countExpedicao > 0 && `(${countExpedicao})`}
          </button>
          <button onClick={() => setTab("concluidos")} style={{ flex: "1", minWidth: "110px", padding: "12px", borderRadius: "12px", border: "none", background: tab === "concluidos" ? "#111" : "#eee", color: tab === "concluidos" ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}>
            ✅ FIM {countConcluidos > 0 && `(${countConcluidos})`}
          </button>
          <button onClick={() => setTab("gestao")} style={{ flex: "1", minWidth: "110px", padding: "12px", borderRadius: "12px", border: "none", background: tab === "gestao" ? "#111" : "#eee", color: tab === "gestao" ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}>
            📊 GESTÃO
          </button>
        </div>
      </header>

      {tab === "gestao" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          <section>
            <h2 style={{ fontSize: "18px", fontWeight: "900", marginBottom: "15px" }}>👤 Financeiro Rodrigo</h2>
            {dadosRodrigo && <FinanceiroDashboard dados={dadosRodrigo} onRegistrarPagamento={handleRegistrarPagamento} />}
          </section>
          <hr style={{ border: "none", borderTop: "1px solid #eee" }} />
          <section>
            <h2 style={{ fontSize: "18px", fontWeight: "900", marginBottom: "15px" }}>📈 Relatórios & Histórico</h2>
            {/* USANDO OS PEDIDOS FORMATADOS PARA UNIFICAR O GRÁFICO */}
            <RelatoriosAdmin pedidos={pedidos} />
          </section>
        </div>
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
