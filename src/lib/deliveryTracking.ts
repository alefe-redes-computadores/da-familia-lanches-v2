import { normalizarStatus } from "@/lib/orderUtils";

type OrderLike = Record<string, unknown>;
export type DeliveryTrackingPresentation = {
  visible: boolean; terminal: boolean; tone: "route"|"next"|"done"|"issue";
  eyebrow: string; title: string; description: string; detail: string | null;
  stopsAhead: number | null; totalStops: number | null; isNext: boolean;
};
const n=(v:unknown)=>Number.isInteger(v)&&Number(v)>=0?Number(v):null;
const s=(v:unknown)=>typeof v==="string"?v.trim():"";
export function paymentGuidance(order:OrderLike){
  const raw=s(order.metodoPagamento).toLowerCase();
  if(raw.includes("dinheiro")){
    const troco=Number(String(order.trocoPara??"").replace(",","."));
    return Number.isFinite(troco)&&troco>0?`Pagamento em dinheiro · troco para ${troco.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}.`:`Pagamento em dinheiro · se possível, deixe o valor preparado.`;
  }
  if(raw.includes("pix")) return "Pagamento via PIX · deixe o celular por perto para concluir o pagamento.";
  if(raw.includes("debito")||raw.includes("débito")) return "Pagamento no débito · deixe o cartão preparado.";
  if(raw.includes("credito")||raw.includes("crédito")||raw.includes("cartao")||raw.includes("cartão")) return "Pagamento no cartão · deixe o cartão preparado.";
  return raw?`Pagamento: ${s(order.metodoPagamento)}.`:null;
}
export function deliveryTrackingPresentation(order:OrderLike):DeliveryTrackingPresentation{
  const status=normalizarStatus(typeof order.status === 'string' ? order.status : undefined);
  const pickup=order.tipoEntrega==="pickup";
  const event=s(order.deliveryTrackingEvent);
  const stopsAhead=n(order.deliveryStopsAhead); const totalStops=n(order.deliveryTotalStops);
  const isNext=order.deliveryIsNextStop===true||event==="delivery.next_stop"||stopsAhead===0;
  if(pickup||status==="Cancelado"||!event) return {visible:false,terminal:false,tone:"route",eyebrow:"",title:"",description:"",detail:null,stopsAhead,totalStops,isNext:false};
  if(event==="delivery.completed") return {visible:true,terminal:true,tone:"done",eyebrow:"ENTREGA CONCLUÍDA",title:"Pedido entregue ✓",description:"A operação marcou esta entrega como concluída.",detail:null,stopsAhead,totalStops,isNext:false};
  if(event==="delivery.failed") return {visible:true,terminal:false,tone:"issue",eyebrow:"ATENÇÃO NA ENTREGA",title:"A entrega precisa de atenção",description:s(order.deliveryFailedReason)||"A equipe registrou uma ocorrência na entrega.",detail:null,stopsAhead,totalStops,isNext:false};
  if(isNext) return {visible:true,terminal:false,tone:"next",eyebrow:"VOCÊ É O PRÓXIMO",title:"Prepare-se para receber seu pedido",description:"Sua parada é a próxima pendente na rota de entrega.",detail:paymentGuidance(order),stopsAhead,totalStops,isNext:true};
  if(stopsAhead!==null) return {visible:true,terminal:false,tone:"route",eyebrow:"PEDIDO NA ROTA",title:stopsAhead===1?"1 parada antes da sua":`${stopsAhead} paradas antes da sua`,description:"A posição considera paradas físicas pendentes, não a quantidade de pedidos.",detail:paymentGuidance(order),stopsAhead,totalStops,isNext:false};
  return {visible:true,terminal:false,tone:"route",eyebrow:"PEDIDO NA ROTA",title:"Sua entrega já está na operação",description:"A equipe de entregas já recebeu seu pedido e o acompanhamento atualiza automaticamente.",detail:null,stopsAhead,totalStops,isNext:false};
}
