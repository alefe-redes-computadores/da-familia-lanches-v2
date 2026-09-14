"use client";
import { getOrderItems, paymentLabel } from "@/lib/orderCompat";
import { normalizarStatus, getColorByStatus, formatarData } from "@/lib/orderUtils";
import { statusTitle } from "@/lib/orderStatus";
import styles from "./OrderCard.module.css";

export function OrderCard({ pedido, updateStatus, imprimirPedido }: any) {
  const statusAtual = normalizarStatus(pedido.status);
  const itens = getOrderItems(pedido);
  const telefone = String(pedido.userPhone || pedido.phone || "").trim();
  const pickup = pedido.tipoEntrega === "pickup";
  const total = Number(pedido.total || 0);
  const troco = Number(String(pedido.trocoPara ?? pedido.troco ?? "").replace(",", "."));
  const openWhatsApp = () => { let d=telefone.replace(/\D/g,""); if(!d)return; if(!d.startsWith("55"))d=`55${d}`; window.open(`https://api.whatsapp.com/send?phone=${d}`,"_blank","noopener,noreferrer"); };
  const next = statusAtual === "Pendente" || statusAtual === "Agendado" ? ["Em Produção","ACEITAR","warm"] : statusAtual === "Em Produção" ? ["Pronto","MARCAR PRONTO","green"] : statusAtual === "Pronto" && !pickup ? ["Saiu para Entrega","DESPACHAR","blue"] : (statusAtual === "Saiu para Entrega" || (statusAtual === "Pronto" && pickup)) ? ["Finalizado","CONCLUIR",""] : null;
  return <article className={styles.card} style={{"--status-color":getColorByStatus(pedido.status)} as React.CSSProperties}>
    <div className={styles.top}><div><div className={styles.status}>{statusTitle(pedido.status,pickup)}</div><div className={styles.orderId}>#{String(pedido.id).slice(-8).toUpperCase()}</div></div><span className={styles.date}>{formatarData(pedido.data)}</span></div>
    <div className={styles.person}><div><h3>{pedido.userName || "Cliente"}</h3><div className={styles.phone}>{telefone || "Telefone não informado"}</div></div><div className={styles.metaActions}>{telefone&&<button className={styles.iconBtn} onClick={openWhatsApp} title="Abrir WhatsApp">W</button>}<button className={styles.iconBtn} onClick={()=>imprimirPedido(pedido)} title="Imprimir">P</button></div></div>
    <div className={styles.delivery}><b>{pickup?"RETIRADA NO BALCÃO":"ENTREGA"}</b>{pedido.endereco || (pickup?"Retirada no local":"Endereço não informado")}</div>
    <div className={styles.items}>{itens.length?itens.map((item,i)=><div className={styles.item} key={`${item.name}-${i}`}><b>{item.quantity}x {item.name}</b>{item.selectedAddons.map(a=><div className={styles.addon} key={`${a.id}-${a.name}`}>+ {a.name}</div>)}{item.observation&&<div className={styles.obs}>Obs.: {item.observation}</div>}</div>):<span>Pedido antigo sem itens reconhecíveis.</span>}</div>
    <div className={styles.money}><div className={styles.moneyRow}><div><small>Pagamento</small><b>{paymentLabel(pedido.metodoPagamento)}</b></div><div className={styles.total}><small>Total</small><strong>R$ {Number.isFinite(total)?total.toFixed(2):"0.00"}</strong></div></div>{paymentLabel(pedido.metodoPagamento)==="DINHEIRO"&&Number.isFinite(troco)&&troco>0&&<div className={styles.cash}>Troco para R$ {troco.toFixed(2)}</div>}</div>
    {next&&<div className={styles.actions}><button className={styles.primary} data-tone={next[2]} onClick={()=>updateStatus(pedido.id,next[0],pedido)}>{next[1]}</button></div>}
  </article>;
}
