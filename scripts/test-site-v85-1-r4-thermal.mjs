import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const layout = fs.readFileSync("src/lib/thermalReceipt.ts", "utf8");
const print = fs.readFileSync("src/lib/printOrder.ts", "utf8");
const checks = (name, condition) => { assert.ok(condition, `R4: ${name}`); console.log("✓", name); };

const compiled = ts.transpileModule(layout, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const sandbox = {
  module, exports: module.exports,
  require(name) {
    if (name === "./adminOrderAddress") return { adminOrderAddress(order) {
      return { full: order.deliverySnapshot ? `${order.deliverySnapshot.street}, ${order.deliverySnapshot.number} — ${order.deliverySnapshot.district} · Ref.: ${order.deliverySnapshot.reference}` : "" };
    }};
    if (name === "./orderCompat") return {
      getOrderItems(order) {return order.itens || [];},
      paymentLabel(method) {return method === "dinheiro" ? "DINHEIRO" : "PIX";},
      orderDateToDate(v) { if(!v)return null;const d=new Date(v);return Number.isFinite(d.getTime())?d:null; },
    };
    throw Error(`Import inesperado: ${name}`);
  },
  Intl, Date, String, Number,
};
vm.runInNewContext(compiled, sandbox);
const { buildThermalReceiptHtml, escapeThermalText } = module.exports;
const order = {
  id:"abc-xyz-12345678", data:"2026-10-22T18:00:00-03:00",tipoEntrega:"delivery",status:"Em Produção",
  userName:"Cliente <script>ALERTA</script>",userPhone:"34999999999",
  deliverySnapshot:{street:"Rua dos Ipês comprida",number:"1234",district:"Bairro das Palmeiras",reference:"Perto da praça <img src=x onerror=alert(1)>"},
  itens:[{name:"BITELA com filé de frango",quantity:2,selectedAddons:[{id:"a",name:"Mussarela extra"}],observation:"SEM CEBOLA / cuidado com o molho"}],
  observacao:"Entregar pela lateral",subtotal:80,taxaEntrega:4,desconto:3,total:81,
  metodoPagamento:"dinheiro",trocoPara:"100,00",cupom:"OFERTA",
};
const html = buildThermalReceiptHtml(order, "58");
checks("renderiza entrada e campos reais", html.includes("PEDIDO #12345678") && html.includes("BITELA com filé de frango"));
checks("endereço estruturado completo, sem resumo truncado", html.includes("Rua dos Ipês comprida") && html.includes("Bairro das Palmeiras"));
checks("texto de endereço e cliente com escape anti-injeção", html.includes("&lt;script&gt;") && html.includes("&lt;img src=x onerror=alert(1)&gt;"));
checks("não contém script não escapado do cliente", !html.includes("<script>ALERTA</script>"));
checks("observação, adicionais e quantidades mantidos", html.includes("SEM CEBOLA") && html.includes("Mussarela extra") && html.includes("2×"));
checks("valores brasileiros corretos sem recalcular autoridade comercial", html.includes("R$&nbsp;81,00") || html.includes("R$ 81,00") || html.includes("R$ 81,00"));
checks("troco reconhece separador brasileiro", html.includes("Troco para") && html.includes("100,00"));
checks("58 mm usa área útil 48 mm", html.includes('[data-profile="58"] .receipt { width: 48mm; }'));
checks("80 mm usa área conservadora 68 mm", html.includes('[data-profile="80"] .receipt { width: 68mm; }'));
checks("página não força altura de papel", html.includes("@page { size: auto; margin: 0; }") && !html.includes("size: 58mm 200mm"));
checks("preview exige toque explícito para imprimir", html.includes("addEventListener('click',function(){window.print();})") && !html.includes("window.onload=function(){window.print()"));
checks("não fecha popup sozinho nem tem print temporizado", !print.includes("window.close") && !print.includes("setTimeout") && !print.includes("window.print"));
checks("pode alternar bobina sem gerar outro pedido", html.includes("data-set-paper=\"58\"") && html.includes("data-set-paper=\"80\""));
checks("pickup não inventa endereço", buildThermalReceiptHtml({...order,tipoEntrega:"pickup"},"58").includes("RETIRADA NO LOCAL"));
checks("largura desconhecida não vira impressão silenciosa", print.includes('buildThermalReceiptHtml(pedido, "58")') && print.includes('window.open'));
checks("HTML conserva conteúdo de pedidos antigos", buildThermalReceiptHtml({id:"legacy",itens:[],total:10},"58").includes("Itens não disponíveis"));
checks("escape literal de caracteres especiais", escapeThermalText(`'&<>`).includes("&amp;&lt;&gt;"));
console.log("DFL SITE V85.1 R4 — TICKET TERMICO SEGURO: 17 TESTES APROVADOS");
