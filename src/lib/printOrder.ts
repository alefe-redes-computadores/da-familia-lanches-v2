import { getOrderItems, paymentLabel } from "./orderCompat";
import { formatarData } from "./orderUtils";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const imprimirPedido = (pedido: any) => {
  const janela = window.open("", "", "width=600,height=800");
  if (!janela) {
    alert("Libere os pop-ups para imprimir o pedido.");
    return;
  }

  const itens = getOrderItems(pedido);
  const itensHtml = itens.map((item) => {
    const addons = item.selectedAddons.map((addon) => `<div style="margin-left:10px;font-size:12px">+ ${escapeHtml(addon.name)}</div>`).join("");
    const observation = item.observation ? `<div style="margin-left:10px;font-size:12px">Obs.: ${escapeHtml(item.observation)}</div>` : "";
    return `<div style="border-bottom:1px dashed #ccc;padding:10px 0;font-size:14px"><div><b>${item.quantity}x ${escapeHtml(item.name)}</b></div>${addons}${observation}</div>`;
  }).join("");

  const total = Number(pedido.total || 0);
  const troco = Number(pedido.trocoPara ?? pedido.troco ?? 0);
  const tipo = pedido.tipoEntrega === "pickup" ? "RETIRADA" : "ENTREGA";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pedido Família Lanches</title></head><body style="font-family:'Courier New',monospace;padding:20px;color:#000"><center><h2 style="margin:0">DA FAMÍLIA LANCHES</h2><p>----------------------------</p><p style="font-weight:bold">PEDIDO #${escapeHtml(pedido.id ? String(pedido.id).slice(-6).toUpperCase() : "000000")}</p><p>----------------------------</p></center><p><b>CLIENTE:</b> ${escapeHtml(pedido.userName || "Cliente não identificado")}</p><p><b>TEL:</b> ${escapeHtml(pedido.userPhone || pedido.phone || "NÃO INFORMADO")}</p><p><b>DATA:</b> ${escapeHtml(formatarData(pedido.data))}</p><p><b>ENTREGA:</b> ${tipo}</p><p><b>ENDEREÇO:</b> ${escapeHtml(pedido.endereco || (tipo === "RETIRADA" ? "Retirada no balcão" : "Endereço não informado"))}</p><p>----------------------------</p><div>${itensHtml || "<p>Nenhum item reconhecido neste pedido.</p>"}</div><p>----------------------------</p><p><b>PAGAMENTO:</b> ${escapeHtml(paymentLabel(pedido.metodoPagamento))}</p>${troco > 0 ? `<p><b>TROCO PARA:</b> R$ ${troco.toFixed(2)}</p>` : ""}<p style="font-size:20px"><b>TOTAL: R$ ${Number.isFinite(total) ? total.toFixed(2) : "0.00"}</b></p>${pedido.observacao ? `<p><b>OBS:</b> ${escapeHtml(pedido.observacao)}</p>` : ""}<p>----------------------------</p><center><p style="font-size:12px">Impresso em: ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p></center><script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}<\/script></body></html>`;

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
};
