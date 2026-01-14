import { formatarData } from "./orderUtils";

export const imprimirPedido = (pedido: any) => {
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