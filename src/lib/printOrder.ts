import { buildThermalReceiptHtml } from "./thermalReceipt";

/** Abre prévia de bobina; impressão automática fica DESLIGADA até validar o hardware. */
export const imprimirPedido = (pedido: unknown) => {
  const janela = window.open("", "_blank", "width=480,height=850");
  if (!janela) {
    window.alert("O navegador bloqueou a prévia. Permita pop-ups para imprimir o pedido.");
    return;
  }
  // Não há impressão ou fechamento temporizado: quem opera confere e imprime.
  const html = buildThermalReceiptHtml(pedido, "58");
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
};
