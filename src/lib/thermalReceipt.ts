import { adminOrderAddress } from "./adminOrderAddress";
import { getOrderItems, orderDateToDate, paymentLabel } from "./orderCompat";

/**
 * DFL V85.1 R4 — Somente representação do pedido (sem fila, driver ou impressão automática).
 * Papel 58 mm normalmente tem cabeça útil de 48 mm; 80 mm pode variar entre 64 e 72 mm.
 * A mídia física precisa ser configurada no driver. Não forçamos altura nem corte por CSS.
 */
export type ThermalPaperProfile = "58" | "80";

const money = (value: unknown) => {
  const n = Number(value);
  return (Number.isFinite(n) && n >= 0 ? n : 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
  });
};

export function escapeThermalText(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>) : {};

function timeLabel(value: unknown): string | null {
  const date = orderDateToDate(value);
  return date ? new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date) : null;
}

function moneyInput(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const v = String(value).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const section = (label: string, content: unknown) => {
  const text = String(content ?? "").trim();
  return text ? `<div class="field"><b>${escapeThermalText(label)}:</b> <span>${escapeThermalText(text)}</span></div>` : "";
};

/** HTML standalone, fácil de reaproveitar futuramente na ponte de impressão ESC/POS. */
export function buildThermalReceiptHtml(input: unknown, startProfile: ThermalPaperProfile = "58"): string {
  const order = obj(input);
  const customer = obj(order.customerSnapshot);
  const pickup = order.tipoEntrega === "pickup";
  const address = adminOrderAddress(order);
  const client = String(order.userName || customer.name || order.nomeCliente || "Cliente não informado");
  const phone = String(order.userPhone || customer.phone || customer.phoneE164 || order.phone || "").trim();
  const orderId = String(order.id || "SEM-ID");
  const ref = orderId.slice(-8).toUpperCase();
  const placed = timeLabel(order.data || order.createdAt);
  const scheduled = timeLabel(order.scheduledFor);
  const note = String(order.observacao || "").trim();
  const items = getOrderItems(order);
  const entries = items.map((item) => {
    const additions = item.selectedAddons.map(addon => `<div class="subitem">+ ${escapeThermalText(addon.name)}</div>`).join("");
    return `<section class="item"><div class="itemline"><strong>${escapeThermalText(item.quantity)}× ${escapeThermalText(item.name)}</strong></div>${additions}${item.observation ? `<div class="itemnote"><b>OBS ITEM:</b> ${escapeThermalText(item.observation)}</div>` : ""}</section>`;
  }).join("") || '<p class="notice">Itens não disponíveis no registro antigo.</p>';
  const discount = moneyInput(order.desconto);
  const fee = moneyInput(order.taxaEntrega);
  const subtotal = moneyInput(order.subtotal);
  const changeFor = moneyInput(order.trocoPara ?? order.troco);
  const total = moneyInput(order.total);
  const validTotal = total === null ? "TOTAL NÃO INFORMADO" : money(total);
  const coupon = String(order.cupom || "").trim();
  const fulfillment = pickup ? "RETIRADA NO BALCÃO" : "ENTREGA";
  const shortAddress = pickup ? "RETIRADA NO LOCAL" : (address.full || "Endereço não informado");
  const paper = startProfile === "80" ? "80" : "58";
  const status = String(order.status || "").trim();
  const statusComparable = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const isCancelled = statusComparable.includes("cancel");
  const isScheduled = statusComparable.includes("agendad");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket DFL #${escapeThermalText(ref)}</title>
<style>
@page { size: auto; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 20px 10px; background: #edf0f3; color: #121212; font-family: Arial,Helvetica,sans-serif; }
.ticket-label{font:800 12px/1.3 Arial,sans-serif;letter-spacing:.07em;text-align:center;margin:0 0 5px}
.receipt .kitchen-only{display:none}
body[data-ticket="kitchen"] .receipt .kitchen-only{display:block}
body[data-ticket="kitchen"] .receipt .full-only{display:none!important}
.operational-warning{border:2px solid #000;padding:5px 3px;margin-top:7px;text-align:center;font:900 12px/1.25 Arial,sans-serif;overflow-wrap:anywhere}
.ticket-hint{font-size:12px;line-height:1.4;color:#344451;margin:7px 0 11px}
.print-mode-label{font:800 12px/1.35 system-ui,sans-serif;color:#263541;margin:4px 0 7px}

.controls { max-width: 480px; margin: 0 auto 16px; padding: 13px; border-radius: 14px; background:#fff; border:1px solid #dce2e7; font-family:system-ui,sans-serif; }
.controls h1 { font-size:17px; margin: 0 0 5px; }
.controls p {font-size:12px;line-height:1.4;color:#42515d;margin:3px 0 10px}
.choices {display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.choices button,.print-btn {border:1px solid #cbd5df;background:#f5f7fa;border-radius:10px;color:#18232d;font-weight:700;padding:10px 12px;min-height:44px;cursor:pointer}
.choices button[aria-pressed="true"] { background:#17212b;color:#fff;border-color:#17212b; }
.print-btn {width:100%;background:#e5b52e;border-color:#d7a521;color:#16130c;font-size:15px}
[data-profile="58"] .receipt { width: 48mm; }
[data-profile="80"] .receipt { width: 68mm; }
.receipt { margin:0 auto; background:#fff; padding:1mm 0 3mm; border:0; max-width:100%; font: 10px/1.35 Arial,Helvetica,sans-serif; color:#000; overflow-wrap:anywhere; word-break:normal; }
.receipt * {overflow-wrap:anywhere;max-width:100%}
.head {text-align:center;padding:0 0 7px;border-bottom:1px dashed #000;}
.head h2 {font-size:14px;line-height:1.2;margin:1px 0 3px;letter-spacing:.03em}
.head strong {display:block;font-size:13px;margin-top:5px}
.small {font-size:9px;color:#111}
.block {padding:7px 0;border-bottom:1px dashed #333}
.field {display:block;margin:3px 0;line-height:1.35}
.field b {font-weight:800}
.label {font-weight:900;font-size:10px;letter-spacing:.045em;margin:0 0 5px}
.item {padding:5px 0;border-top:1px dotted #777;break-inside:avoid-page;page-break-inside:avoid}
.item:first-of-type {border-top:0}
.itemline {font-size:11px;line-height:1.28}
.subitem {padding-left:9px;font-size:10px}
.itemnote {margin-top:4px;border-left:2px solid #000;padding-left:6px;font-size:10px;font-weight:600}
.row {display:flex;justify-content:space-between;gap:8px;padding:2px 0;align-items:flex-start}
.row b {flex:0 0 auto;white-space:nowrap}
.total {border-top:2px solid #000;margin-top:5px;padding-top:5px;font-size:14px;font-weight:900}
.footer {text-align:center;margin-top:9px;padding-bottom:3mm;border-top:1px dashed #333;padding-top:7px}
/* R5 — tirinha de calibração USB: somente prévia/teste manual, nenhuma conexão direta. */
.calibration{display:none;width:48mm;max-width:100%;margin:0 auto;padding:1mm 0 3mm;background:#fff;color:#000;font:10px/1.35 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}
[data-profile="80"] .calibration{width:68mm}
[data-mode="calibration"] .receipt{display:none}
[data-mode="calibration"] .calibration{display:block}
.calibration h2{text-align:center;margin:0 0 7px;font-size:12px}
.calibration p{margin:6px 0;font-size:10px}
.calibration .border-test{width:100%;height:20mm;border-left:2px solid #000;border-right:2px solid #000;border-top:1px dashed #000;border-bottom:1px dashed #000;display:flex;justify-content:space-between;align-items:center;gap:4px;padding:2mm 1mm}
.calibration .border-test span{font-size:8px;overflow-wrap:anywhere}
.calibration .border-test span:nth-child(2){text-align:center}
.calibration .border-test span:last-child{text-align:right}
.cal-btn{width:100%;min-height:40px;margin-bottom:9px;padding:8px 10px;border:1px solid #cbd5df;border-radius:10px;background:#fff;color:#19262f;font:700 12px system-ui,sans-serif;cursor:pointer}
.cal-btn[aria-pressed="true"]{background:#d8f2e2;border-color:#65b68b;color:#155234}
.notice {font-weight:700}
@media screen { .receipt {box-shadow:0 4px 20px #0002;} }
@media print {
  html,body {width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;background:white!important;overflow:visible!important;}
  .controls {display:none!important}
  .receipt {margin:0!important;border:0!important;box-shadow:none!important;max-width:100%!important;padding:0 0 2mm!important;}
  [data-profile="58"] .receipt {width:48mm!important}
  [data-profile="80"] .receipt {width:68mm!important}
  .item {break-inside:avoid-page;page-break-inside:avoid}
  .calibration{margin:0!important;box-shadow:none!important}
}
</style></head>
<body data-profile="${paper}" data-ticket="full">
<div class="controls" role="region" aria-label="Prévia de impressão térmica">
<h1>Prévia da bobina</h1>
<p>Confira o cupom antes de imprimir. Selecione o papel no driver: 58 mm (conteúdo 48 mm) ou 80 mm (conteúdo conservador 68 mm). Sem impressão automática.</p>
<div class="choices"><button type="button" data-set-paper="58" aria-pressed="${paper === "58"}">Bobina 58 mm</button><button type="button" data-set-paper="80" aria-pressed="${paper === "80"}">Bobina 80 mm</button></div>
<div class="print-mode-label">O que deseja imprimir?</div>
<div class="choices" role="group" aria-label="Tipo de ticket"><button type="button" data-set-ticket="full" aria-pressed="true">Completo</button><button type="button" data-set-ticket="kitchen" aria-pressed="false">Preparo / Cozinha</button></div>
<p class="ticket-hint" id="dfl-ticket-hint">Completo: cliente, endereço, itens e fechamento. Confira a prévia antes de imprimir.</p>
<button type="button" class="cal-btn" id="dfl-calibrate" aria-pressed="false">Conferir largura: teste curto da bobina</button>
<button type="button" class="print-btn" id="dfl-print-now">Imprimir após conferir</button>
<p>Ajuste o tamanho da mídia no diálogo de impressão. Se a prévia for cortada, NÃO imprima; confira a largura configurada na impressora.</p>
</div>
<main class="receipt" aria-label="Ticket do pedido">
<header class="head"><div class="ticket-label kitchen-only">VIA COZINHA • PREPARO</div><h2>DA FAMÍLIA LANCHES</h2><div>${escapeThermalText(fulfillment)}</div><strong>PEDIDO #${escapeThermalText(ref)}</strong>${placed ? `<div class="small">${escapeThermalText(placed)}</div>` : ""}${isCancelled ? '<div class="operational-warning">CANCELADO — NÃO PRODUZIR</div>' : isScheduled ? '<div class="operational-warning">PEDIDO AGENDADO — CONFERIR HORÁRIO</div>' : ""}</header>
<div class="block">${section("Cliente", client)}<div class="full-only">${section("Telefone", phone)}</div>${section("Status", status)}${scheduled ? section("Agendado", scheduled) : ""}<div class="full-only">${section("Endereço", shortAddress)}</div>${section("Obs. geral", note)}</div>
<section class="block"><div class="label">ITENS DO PEDIDO</div>${entries}</section>
<section class="block full-only"><div class="label">FECHAMENTO</div>${subtotal !== null ? `<div class="row"><span>Subtotal</span><b>${money(subtotal)}</b></div>` : ""}${fee !== null ? `<div class="row"><span>Entrega</span><b>${money(fee)}</b></div>` : ""}${discount !== null && discount > 0 ? `<div class="row"><span>Desconto</span><b>- ${money(discount)}</b></div>` : ""}${coupon ? section("Cupom", coupon) : ""}<div class="row total"><span>TOTAL</span><b>${validTotal}</b></div>${section("Pagamento", paymentLabel(order.metodoPagamento))}${paymentLabel(order.metodoPagamento) === "DINHEIRO" && changeFor !== null && changeFor > 0 ? section("Troco para", money(changeFor)) : ""}</section>
<footer class="footer"><b>Da Família Lanches</b><div class="small full-only">Ticket de operação • reimpressão manual</div><div class="small kitchen-only">Ticket interno • conferir observações</div></footer>
</main>
<section class="calibration" aria-label="Teste de largura da bobina">
<h2>DFL — TESTE DE LARGURA</h2>
<p>LINHA CURTA • USB GENÉRICA • 58/80 MM</p>
<div class="border-test"><span>INÍCIO<br>ESQ.</span><span>CENTRO<br>SEM CORTE</span><span>FIM<br>DIR.</span></div>
<p>Se as DUAS bordas laterais aparecerem, o alinhamento está adequado. Se alguma borda sumir: confira a largura do papel e as margens do driver antes de imprimir pedidos reais.</p>
<p>Este teste não envia comandos de corte. A impressora/driver decide como avançar a bobina.</p>
</section>
<script>
(function(){
  var controls=document.querySelectorAll('[data-set-paper]');
  for(var i=0;i<controls.length;i++){
    controls[i].addEventListener('click',function(){
      var value=this.getAttribute('data-set-paper');
      document.body.setAttribute('data-profile',value==='80'?'80':'58');
      for(var j=0;j<controls.length;j++) controls[j].setAttribute('aria-pressed',String(controls[j]===this));
    });
  }
  var ticketControls=document.querySelectorAll('[data-set-ticket]');
  var ticketHint=document.getElementById('dfl-ticket-hint');
  for(var k=0;k<ticketControls.length;k++){
    ticketControls[k].addEventListener('click',function(){
      var kitchen=this.getAttribute('data-set-ticket')==='kitchen';
      document.body.setAttribute('data-ticket',kitchen?'kitchen':'full');
      for(var n=0;n<ticketControls.length;n++)ticketControls[n].setAttribute('aria-pressed',String(ticketControls[n]===this));
      if(ticketHint) ticketHint.textContent=kitchen?'Preparo: destaque para itens, adicionais e observações. Sem dados de telefone, endereço ou valores.':'Completo: cliente, endereço, itens e fechamento. Confira a prévia antes de imprimir.';
    });
  }
  var calibrationButton=document.getElementById('dfl-calibrate');
  var printButton=document.getElementById('dfl-print-now');
  calibrationButton.addEventListener('click',function(){
    var calibration=document.body.getAttribute('data-mode')!=='calibration';
    document.body.setAttribute('data-mode',calibration?'calibration':'ticket');
    calibrationButton.setAttribute('aria-pressed',String(calibration));
    calibrationButton.textContent=calibration?'Voltar ao cupom do pedido':'Conferir largura: teste curto da bobina';
    printButton.textContent=calibration?'Imprimir SOMENTE teste curto':'Imprimir após conferir';
  });
  printButton.addEventListener('click',function(){window.print();});
})();
<\/script></body></html>`;
}
