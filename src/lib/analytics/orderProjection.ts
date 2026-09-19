import { normalizarStatus } from "@/lib/orderUtils";
import { normalizePaymentMethod, orderDateToDate } from "@/lib/orderCompat";
import type { AnalyticsDailyV2,AnalyticsSummaryV2 } from "./types";
const n=(v:unknown)=>{const x=Number(v||0);return Number.isFinite(x)?x:0};
const dk=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
export function projectOrdersV2(orders:any[],days=0):AnalyticsSummaryV2{
 const cutoff=days>0?Date.now()-(days-1)*86400000:null,map=new Map<string,AnalyticsDailyV2>();
 for(const o of orders){if(normalizarStatus(String(o.status||""))!=="Finalizado")continue;const d=orderDateToDate(o.data);if(!d||cutoff&&d.getTime()<cutoff)continue;
 const k=dk(d),pm=normalizePaymentMethod(o.metodoPagamento)||"other",r=map.get(k)??{dateKey:k,salesCount:0,revenue:0,subtotal:0,deliveryFees:0,discounts:0,deliveries:0,pickups:0,scheduled:0,payments:{}};
 const total=n(o.total);r.salesCount++;r.revenue+=total;r.subtotal+=n(o.subtotal);r.deliveryFees+=n(o.taxaEntrega);r.discounts+=n(o.desconto);o.tipoEntrega==="pickup"?r.pickups++:r.deliveries++;if(o.isAgendamento===true)r.scheduled++;
 const pay=r.payments[pm]??{count:0,revenue:0};pay.count++;pay.revenue+=total;r.payments[pm]=pay;map.set(k,r)}
 const rows=[...map.values()].sort((a,b)=>b.dateKey.localeCompare(a.dateKey)),out:AnalyticsSummaryV2={source:"legacy",days:rows,totalSales:0,revenue:0,subtotal:0,deliveryFees:0,discounts:0,deliveries:0,pickups:0,scheduled:0,payments:{}};
 for(const r of rows){out.totalSales+=r.salesCount;out.revenue+=r.revenue;out.subtotal+=r.subtotal;out.deliveryFees+=r.deliveryFees;out.discounts+=r.discounts;out.deliveries+=r.deliveries;out.pickups+=r.pickups;out.scheduled+=r.scheduled;for(const [k,v] of Object.entries(r.payments)){const x=out.payments[k]??{count:0,revenue:0};x.count+=v.count;x.revenue+=v.revenue;out.payments[k]=x}}
 return out}
