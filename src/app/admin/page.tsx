"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch
} from "firebase/firestore";
import { useAuthStore } from "@/store/auth.store";

// --- FUNÇÃO DE DATA REVISADA (Dia/Mês e Hora) ---
const formatarData = (data: any) => {
  if (!data) return "--/-- --:--";
  try {
    if (typeof data.toDate === 'function') {
      const d = data.toDate();
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    const d = new Date(data.seconds ? data.seconds * 1000 : data);
    return isNaN(d.getTime()) ? "--/-- --:--" : d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return "--/-- --:--";
  }
};

export default function AdminPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [tab, setTab] = useState<"cozinha" | "expedicao" | "concluidos">("cozinha");
  const { currentUser } = useAuthStore();
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  const prevPedidosCount = useRef(0);
  const isFirstLoad = useRef(true);

  const admins = [
    "alefejohsefe@gmail.com",
    "kalebhstanley650@gmail.com",
    "contato@dafamilialanches.com.br"
  ];

  const controlarAlarme = (ligar: boolean) => {
    if (ligar) {
      setAlarmeAtivo(true);
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(e => console.log("Aguardando interação para tocar som..."));

      setTimeout(() => {
        // Usa a ref prevPedidosCount para verificar se ainda existem pedidos pendentes
        if (prevPedidosCount.current > 0) {
          controlarAlarme(true);
        } else {
          setAlarmeAtivo(false);
        }
      }, 4000);
    } else {
      setAlarmeAtivo(false);
    }
  };

  const avisarWhatsApp = (telefone: string, nome: string, status: string) => {
    if (!telefone) {
      alert("Atenção: Este pedido não possui número de telefone cadastrado.");
      return;
    }
    let foneLimpo = telefone.replace(/\D/g, "");
    if (foneLimpo.length > 0 && !foneLimpo.startsWith("55")) foneLimpo = `55${foneLimpo}`;

    const mensagens: any = {
      "Pronto": `Olá ${nome}! Seu pedido da Família Lanches está PRONTO para retirada! 🥡🔥`,
      "Saiu para Entrega": `Olá ${nome}! Seu pedido da Família Lanches SAIU para entrega com o motoboy! 🛵💨`,
    };

    const texto = encodeURIComponent(mensagens[status] || `Olá ${nome}! Seu pedido está sendo atualizado.`);
    const url = `https://api.whatsapp.com/send?phone=${foneLimpo}&text=${texto}`;
    window.open(url, "_blank");
  };

  const imprimirPedido = (pedido: any) => {
    const janela = window.open('', '', 'width=600,height=800');
    if (!janela) {
      alert("Por favor, libere os pop-ups para imprimir o cupom.");
      return;
    }

    const nomeCliente = pedido.userName || "Cliente não identificado";
    const endereco = pedido.endereco || "Endereço não informado";
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

    const itensHtml = itens.map((item: any) => `
      <div style="border-bottom: 1px dashed #ccc; padding: 10px 0; font-size: 14px;">
        <div style="display: flex; justify-content: space-between;">
          <b>${item.quantity || 1}x ${item.name || "Item"}</b>
          <span>R$ ${(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
        </div>
        ${item.selectedAddons?.map((a: any) => `<div style="margin-left: 10px; font-size: 12px;">+ ${a.name}</div>`).join("") || ""}
      </div>
    `).join("");

    const conteudoCupom = `
      <html>
        <head><title>Cupom Família Lanches</title></head>
        <body style="font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000;">
          <center>
            <h2 style="margin:0;">DA FAMÍLIA LANCHES</h2>
            <p style="margin:5px 0;">----------------------------</p>
            <p style="margin:0; font-weight:bold;">PEDIDO #${pedido.id ? pedido.id.slice(-4).toUpperCase() : "0000"}</p>
            <p style="margin:5px 0;">----------------------------</p>
          </center>
          <p><b>CLIENTE:</b> ${nomeCliente}</p>
          <p><b>TEL:</b> ${pedido.userPhone || "NÃO INFORMADO"}</p>
          <p><b>DATA:</b> ${formatarData(pedido.data)}</p>
          <p><b>ENTREGA:</b> ${pedido.tipoEntrega === 'pickup' ? 'RETIRADA' : 'ENTREGA'}</p>
          <p><b>ENDEREÇO:</b> ${endereco}</p>
          <p>----------------------------</p>
          <div style="margin: 10px 0;">${itensHtml || "<p>Nenhum item no pedido</p>"}</div>
          <p>----------------------------</p>
          <p><b>PAGAMENTO:</b> ${pedido.metodoPagamento?.toUpperCase() || "N/A"}</p>
          ${pedido.troco ? `<p><b>TROCO PARA:</b> ${pedido.troco}</p>` : ""}
          <p style="font-size: 20px; margin-top:10px;"><b>TOTAL: R$ ${Number(pedido.total || 0).toFixed(2)}</b></p>
          <p>----------------------------</p>
          <center><p style="font-size:12px;">Impresso em: ${new Date().toLocaleString()}</p></center>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    janela.document.open();
    janela.document.write(conteudoCupom);
    janela.document.close();
  };
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const novosPedidosCount = docs.filter((p: any) => p.status === "Pendente" || !p.status).length;

      if (!isFirstLoad.current && novosPedidosCount > prevPedidosCount.current) {
        controlarAlarme(true); // Ativa o loop persistente
      }

      // Se aceitou tudo, desliga o estado do alarme
      if (novosPedidosCount === 0) setAlarmeAtivo(false);


      prevPedidosCount.current = novosPedidosCount;
      isFirstLoad.current = false;

      setPedidos(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const unsub = onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) setStoreOpen(snap.data().isOpen);
    });
    return () => unsub();
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
        avisarWhatsApp(pedido.userPhone, pedido.userName, "Pronto");
      } else if (newStatus === "Saiu para Entrega") {
        avisarWhatsApp(pedido.userPhone, pedido.userName, "Saiu para Entrega");
      }
    } catch (e) { alert("Erro ao atualizar status"); }
  };

  const limparFinalizados = async () => {
    if (!confirm("Deseja arquivar todos os pedidos finalizados?")) return;
    const batch = writeBatch(db);
    pedidos.filter(p => p.status === "Finalizado").forEach(p => {
      batch.delete(doc(db, "Pedidos", p.id));
    });
    await batch.commit();
  };
  const pedidosFiltrados = pedidos.filter(p => {
    // Garantimos que o status seja uma string e aceitamos variações
    const s = String(p.status || "Pendente").trim();
    
    if (tab === "cozinha") {
      // Aceita "Pendente", "Em Produção" ou qualquer um sem status definido
      return s === "Pendente" || s === "Em Produção" || !p.status;
    }
    
    if (tab === "expedicao") {
      return s === "Pronto" || s === "Saiu para Entrega";
    }
    
    // Aba Finalizados
    return s === "Finalizado";
  });

  if (!currentUser || !admins.includes(currentUser.email!)) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px", fontFamily: "sans-serif" }}>
        <h1>Acesso Negado 🔐</h1>
        <button onClick={() => window.location.href = "/"} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>Voltar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", fontFamily: "sans-serif", backgroundColor: "#fcfcfc", minHeight: "100vh" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", margin: 0, color: "#111" }}>📟 Monitor da Família</h1>

          <div style={{ display: "flex", gap: "15px", marginTop: "15px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={toggleStore}
              style={{
                padding: "12px 24px", borderRadius: "12px", border: "none", fontWeight: "bold", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "10px",
                background: storeOpen ? "#4caf50" : "#f44336", color: "#fff",
                boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
              }}
            >
              {storeOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
            </button>

            <div style={{ display: "flex", background: "#eee", padding: "4px", borderRadius: "12px" }}>
              <button onClick={() => setTab("cozinha")} style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "cozinha" ? "#fff" : "transparent", fontWeight: "bold", color: tab === "cozinha" ? "#111" : "#666" }}>🔥 Cozinha ({pedidos.filter(p => !p.status || p.status === "Pendente" || p.status === "Em Produção").length})</button>
              <button onClick={() => setTab("expedicao")} style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "expedicao" ? "#fff" : "transparent", fontWeight: "bold", color: tab === "expedicao" ? "#111" : "#666" }}>🚚 Expedição ({pedidos.filter(p => p.status === "Pronto" || p.status === "Saiu para Entrega").length})</button>
              <button onClick={() => setTab("concluidos")} style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "concluidos" ? "#fff" : "transparent", fontWeight: "bold", color: tab === "concluidos" ? "#111" : "#666" }}>✅ Finalizados</button>
            </div>

            {tab === "concluidos" && (
              <button onClick={limparFinalizados} style={{ background: "#ff5252", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>Limpar Lista</button>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "13px", color: "#444", margin: 0 }}><b>{currentUser.email}</b></p>
          <span style={{ fontSize: "11px", color: "#666" }}>Gestor 4.1.0 Ativo 🔊</span>
        </div>
      </header>
      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#999" }}>Carregando dados da Família...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "25px" }}>
          {pedidosFiltrados.map(pedido => (
            <div key={pedido.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "20px", padding: "20px", boxShadow: "0 10px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", padding: "5px 12px", borderRadius: "50px", background: "#f5f5f5", color: "#555" }}>
                  {pedido.status ? pedido.status.toUpperCase() : "PENDENTE"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "600" }}>{formatarData(pedido.data)}</span>
                  <button onClick={() => imprimirPedido(pedido)} style={{ background: "#f5f5f5", border: "none", padding: "5px 8px", borderRadius: "8px", cursor: "pointer" }}>🖨️</button>
                </div>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <h3 style={{ margin: "0", fontSize: "20px", fontWeight: "700" }}>{pedido.userName}</h3>

                    {/* --- NOVO DESIGN DO TELEFONE --- */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {pedido.userPhone && (
                        <span style={{ fontSize: "13px", color: "#111", fontWeight: "bold", background: "#ffca28", padding: "2px 8px", borderRadius: "5px" }}>
                          📞 {pedido.userPhone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          let f = pedido.userPhone?.replace(/\D/g, "");
                          if (f && !f.startsWith("55")) f = `55${f}`;
                          if (f) window.open(`https://api.whatsapp.com/send?phone=${f}`, "_blank");
                        }}
                        style={{ background: "#25D366", border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      </button>
                    </div>
                  </div>
                  <span style={{ fontSize: "10px", color: "#ccc" }}>#{pedido.id.slice(-4).toUpperCase()}</span>
                </div>

                <div style={{ marginTop: "10px", padding: "10px", borderRadius: "12px", background: pedido.tipoEntrega === "pickup" ? "#e3f2fd" : "#fff3e0", color: "#444", fontSize: "13px", border: "1px solid", borderColor: pedido.tipoEntrega === "pickup" ? "#bbdefb" : "#ffe0b2" }}>
                  <b>📍 {pedido.tipoEntrega === "pickup" ? "🥡 RETIRADA" : "🛵 ENTREGA"}</b><br />{pedido.endereco}
                </div>
              </div>
              <div style={{ background: "#f8f9fa", borderRadius: "15px", padding: "15px", marginBottom: "15px", flex: 1 }}>
                {Array.isArray(pedido.itens) ? (
                  pedido.itens.map((item: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: "10px", borderBottom: idx !== (pedido.itens.length - 1) ? "1px solid #eee" : "none", paddingBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "14px", fontWeight: "600" }}>{item.quantity}x {item.name}</span>
                        <span style={{ fontSize: "13px", color: "#888" }}>R$ {(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                      {Array.isArray(item.selectedAddons) && item.selectedAddons.length > 0 && (
                        <div style={{ fontSize: "12px", color: "#d32f2f", marginTop: "5px", fontWeight: "900", background: "#ffebee", padding: "4px 8px", borderRadius: "6px" }}>
                          + EXTRA: {item.selectedAddons.map((a: any) => a.name.toUpperCase()).join(", ")}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: "12px", color: "#999", textAlign: "center" }}>⚠️ Sem itens registrados.</div>
                )}
              </div>

              <div style={{ marginBottom: "20px", borderTop: "2px dashed #eee", paddingTop: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#666", fontSize: "13px", marginBottom: "5px" }}>
                  <span>{pedido.metodoPagamento?.toUpperCase()}</span>
                  {pedido.troco && <span>Troco: {pedido.troco}</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>Total:</span>
                  <span style={{ fontSize: "22px", fontWeight: "800", color: "#111" }}>R$ {Number(pedido.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {tab === "cozinha" && (pedido.status === "Pendente" || !pedido.status) && <button onClick={() => updateStatus(pedido.id, "Em Produção")} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "1px solid #ddd", background: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "13px" }}>ACEITAR</button>}
                {tab === "cozinha" && pedido.status === "Em Produção" && <button onClick={() => updateStatus(pedido.id, "Pronto", pedido)} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "none", background: "#4caf50", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "13px" }}>{pedido.tipoEntrega === "pickup" ? "PRONTO (AVISAR ZAP)" : "PRONTO P/ EXPEDIÇÃO"}</button>}
                {tab === "expedicao" && pedido.status === "Pronto" && (
                  pedido.tipoEntrega === "delivery" ?
                    <button onClick={() => updateStatus(pedido.id, "Saiu para Entrega", pedido)} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "none", background: "#2196f3", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "13px" }}>DESPACHAR (AVISAR ZAP)</button> :
                    <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "none", background: "#111", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "13px" }}>FINALIZAR</button>
                )}
                {tab === "expedicao" && pedido.status === "Saiu para Entrega" && <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "14px", borderRadius: "14px", border: "none", background: "#111", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "13px" }}>CONCLUIR</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
