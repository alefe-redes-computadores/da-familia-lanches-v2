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

// --- FUNÇÃO DE DATA (MANTIDA ORIGINAL) ---
const formatarData = (data: any) => {
  if (!data) return "--/-- --:--";
  try {
    const d = data.toDate ? data.toDate() : new Date(data.seconds ? data.seconds * 1000 : data);
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

// --- NORMALIZAÇÃO (MANTIDA ORIGINAL) ---
const normalizarStatus = (status?: string) => {
  if (!status) return "Pendente";
  try {
    const s = String(status).toLowerCase().trim();
    if (s.includes("pendente")) return "Pendente";
    if (s.includes("produção")) return "Em Produção";
    if (s.includes("pronto")) return "Pronto";
    if (s.includes("saiu")) return "Saiu para Entrega";
    if (s.includes("final")) return "Finalizado";
    return "Pendente";
  } catch (e) {
    return "Pendente";
  }
};

// --- CORES DE STATUS ---
const getColorByStatus = (status: string) => {
  const s = normalizarStatus(status);
  if (s === "Pendente") return "#ff9800";
  if (s === "Em Produção") return "#ffca28";
  if (s === "Pronto") return "#4caf50";
  if (s === "Saiu para Entrega") return "#2196f3";
  return "#eee";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const admins = [
    "alefejohsefe@gmail.com", 
    "kalebhstanley650@gmail.com", 
    "contato@dafamilialanches.com.br"
  ];
  // --- CONTROLE DO ALARME ---
  const controlarAlarme = (ligar: boolean) => {
    if (ligar) {
      setAlarmeAtivo(true);
      if (!audioRef.current) {
        audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      }
      audioRef.current.play().catch(e => console.log("Aguardando interação para tocar som..."));

      setTimeout(() => {
        setPedidos(atual => {
          const aindaTemPendente = atual.some(p => normalizarStatus(p.status) === "Pendente");
          if (aindaTemPendente) {
            controlarAlarme(true);
          } else {
            setAlarmeAtivo(false);
          }
          return atual;
        });
      }, 6000);
    } else {
      setAlarmeAtivo(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  // --- FUNÇÃO WHATSAPP PADRONIZADA ---
  const avisarWhatsApp = (telefone: string, nome: string, status: string) => {
    if (!telefone) {
      alert("Atenção: Este pedido não possui número de telefone cadastrado.");
      return;
    }
    let foneLimpo = telefone.replace(/\D/g, "");
    if (foneLimpo.length > 0 && !foneLimpo.startsWith("55")) {
      foneLimpo = `55${foneLimpo}`;
    }
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
        ${Array.isArray(item.selectedAddons) ? item.selectedAddons.map((a: any) => `<div style="margin-left: 10px; font-size: 12px;">+ ${a.name}</div>`).join("") : ""}
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
      const novosPedidosCount = docs.filter((p: any) => normalizarStatus(p.status) === "Pendente").length;
      if (!isFirstLoad.current && novosPedidosCount > prevPedidosCount.current) {
        controlarAlarme(true);
      }
      if (novosPedidosCount === 0) {
        setAlarmeAtivo(false);
      }
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
        avisarWhatsApp(pedido.userPhone || pedido.phone, pedido.userName, "Pronto");
      } else if (newStatus === "Saiu para Entrega") {
        avisarWhatsApp(pedido.userPhone || pedido.phone, pedido.userName, "Saiu para Entrega");
      }
    } catch (e) { alert("Erro ao atualizar status"); }
  };

  const limparFinalizados = async () => {
    if(!confirm("Deseja arquivar todos os pedidos finalizados?")) return;
    try {
      const batch = writeBatch(db);
      const concluidos = Array.isArray(pedidos) 
        ? pedidos.filter(p => normalizarStatus(p.status) === "Finalizado") 
        : [];
      if (concluidos.length === 0) return;
      concluidos.forEach(p => { batch.delete(doc(db, "Pedidos", p.id)); });
      await batch.commit();
    } catch (e) { console.error("Erro ao limpar:", e); }
  };

  const pedidosFiltrados = Array.isArray(pedidos) ? pedidos.filter(p => {
    try {
      const s = normalizarStatus(p.status);
      if (tab === "cozinha") return s === "Pendente" || s === "Em Produção";
      if (tab === "expedicao") return s === "Pronto" || s === "Saiu para Entrega";
      if (tab === "concluidos") return s === "Finalizado";
      return false;
    } catch (e) { return false; }
  }) : [];

  if (!currentUser || !admins.includes(currentUser.email!)) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px", fontFamily: "sans-serif" }}>
        <h1>Verificando Acesso... 🔐</h1>
        <button onClick={() => window.location.href = "/"} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>Voltar</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fcfcfc" }}>
        <h2 style={{ color: "#666", fontFamily: "sans-serif" }}>Carregando Monitor... 📟</h2>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        padding: "15px", 
        maxWidth: "1400px", 
        margin: "85px auto 0 auto", // AQUI ESTÁ O AJUSTE PARA O MONITOR DESCER
        fontFamily: "sans-serif", 
        backgroundColor: "#fcfcfc", 
        minHeight: "100vh" 
      }}
      onClick={() => { if(alarmeAtivo && audioRef.current) audioRef.current.play(); }}
    >
      
      {/* ALERTA DE NOVO PEDIDO */}
      {alarmeAtivo && (
        <div style={{ 
          background: "#d32f2f", color: "#fff", padding: "15px", textAlign: "center", 
          borderRadius: "12px", marginBottom: "20px", fontWeight: "900", 
          boxShadow: "0 4px 15px rgba(211, 47, 47, 0.4)", animation: "pulse 1.5s infinite" 
        }}>
          🚨 NOVO PEDIDO PENDENTE! TOQUE PARA OUVIR 🚨
        </div>
      )}
      <header style={{ marginBottom: "25px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0 }}>📟 Monitor Família</h1>
          <button 
            onClick={toggleStore}
            style={{
              padding: "10px 20px", borderRadius: "10px", border: "none", fontWeight: "bold", cursor: "pointer",
              background: storeOpen ? "#4caf50" : "#f44336", color: "#fff"
            }}
          >
            {storeOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
          </button>
        </div>
        
        <div style={{ display: "flex", background: "#eee", padding: "4px", borderRadius: "12px", marginTop: "20px", width: "fit-content" }}>
          <button 
            onClick={() => setTab("cozinha")}
            style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "cozinha" ? "#fff" : "transparent", fontWeight: "bold" }}
          >
            🔥 Cozinha ({pedidos.filter(p => ["Pendente", "Em Produção"].includes(normalizarStatus(p.status))).length})
          </button>
          <button 
            onClick={() => setTab("expedicao")}
            style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "expedicao" ? "#fff" : "transparent", fontWeight: "bold" }}
          >
            🚚 Entrega
          </button>
          <button 
            onClick={() => setTab("concluidos")}
            style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "concluidos" ? "#fff" : "transparent", fontWeight: "bold" }}
          >
            ✅ Fim
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
        {pedidosFiltrados.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "50px", color: "#999" }}>
            Nenhum pedido aqui no momento.
          </div>
        ) : (
          pedidosFiltrados.map(pedido => {
            const statusAtual = normalizarStatus(pedido.status);
            const itensValidos = Array.isArray(pedido.itens) ? pedido.itens : [];
            
            return (
              <div key={pedido.id} style={{ 
                background: "#fff", border: "1px solid #eee", borderRadius: "18px", padding: "18px",
                boxShadow: "0 6px 15px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column",
                borderLeft: `8px solid ${getColorByStatus(pedido.status)}`
              }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "900", color: getColorByStatus(pedido.status) }}>
                    {statusAtual.toUpperCase()}
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#aaa" }}>{formatarData(pedido.data)}</span>
                    <button onClick={() => imprimirPedido(pedido)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>🖨️</button>
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>{pedido.userName || "Cliente"}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px" }}>
                    <span style={{ background: "#ffca28", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px" }}>
                      📞 {pedido.userPhone || pedido.phone || "S/ Tel"}
                    </span>
                    <button 
                      onClick={() => {
                        const f = (pedido.userPhone || pedido.phone || "").replace(/\D/g, "");
                        const fone = f.startsWith("55") ? f : `55${f}`;
                        window.open(`https://api.whatsapp.com/send?phone=${fone}`, "_blank");
                      }}
                      style={{ background: "#25D366", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  </div>
                </div>

                <div style={{ padding: "10px", borderRadius: "10px", background: pedido.tipoEntrega === "pickup" ? "#e3f2fd" : "#fff3e0", fontSize: "12px", marginBottom: "12px", border: "1px solid #ddd" }}>
                  <b>{pedido.tipoEntrega === "pickup" ? "🥡 RETIRADA" : "🛵 ENTREGA"}</b><br/>{pedido.endereco || "No balcão"}
                </div>

                <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "12px", marginBottom: "12px", flex: 1 }}>
                  {itensValidos.map((item: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: "8px", borderBottom: idx !== itensValidos.length - 1 ? "1px dashed #eee" : "none", paddingBottom: "5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <b>{item.quantity}x {item.name}</b>
                      </div>
                      {item.selectedAddons?.map((a: any, i: number) => (
                        <div key={i} style={{ fontSize: "11px", color: "#d32f2f", fontWeight: "bold" }}>+ {a.name.toUpperCase()}</div>
                      ))}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#666" }}>{pedido.metodoPagamento?.toUpperCase()}</span>
                  <span style={{ fontSize: "18px", fontWeight: "900" }}>R$ {Number(pedido.total || 0).toFixed(2)}</span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  {statusAtual === "Pendente" && (
                    <button onClick={() => updateStatus(pedido.id, "Em Produção")} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#ffca28", border: "none", fontWeight: "bold", cursor: "pointer" }}>ACEITAR</button>
                  )}
                  {statusAtual === "Em Produção" && (
                    <button onClick={() => updateStatus(pedido.id, "Pronto", pedido)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#4caf50", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>PRONTO</button>
                  )}
                  {statusAtual === "Pronto" && (
                    <button onClick={() => updateStatus(pedido.id, "Saiu para Entrega", pedido)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#2196f3", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>DESPACHAR</button>
                  )}
                  {(statusAtual === "Saiu para Entrega" || (statusAtual === "Pronto" && pedido.tipoEntrega === "pickup")) && (
                    <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#111", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>CONCLUIR</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
