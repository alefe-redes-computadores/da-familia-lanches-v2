"use client";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCustomerOrderStats } from "@/hooks/useCustomerOrderStats";
import styles from "./RewardsModal.module.css";

export function RewardsModal(){
 const closeModal=useUIStore(s=>s.closeModal);
 const currentUser=useAuthStore(s=>s.currentUser);
 const stats=useCustomerOrderStats();
 return <ModalBase title="Sua historia na Da Familia" onClose={closeModal}><div className={styles.body}>
 {!currentUser?<div className={styles.empty}><strong>Entre para ver seu historico</strong><p>Seus pedidos ficam vinculados a sua conta e poderao ser usados por campanhas reais de fidelidade.</p></div>
 :stats.loading?<div className={styles.empty}><p>Carregando seus pedidos...</p></div>
 :stats.error?<div className={styles.empty}><strong>Historico indisponivel agora</strong><p>{stats.error}</p></div>
 :<><section className={styles.hero}><span>HISTORICO REAL</span><strong>{stats.completed}</strong><p>pedido{stats.completed===1?"":"s"} concluido{stats.completed===1?"":"s"}</p></section>
 <div className={styles.stats}><div><strong>{stats.total}</strong><span>registrados</span></div><div><strong>{stats.active}</strong><span>em andamento</span></div><div><strong>{stats.cancelled}</strong><span>cancelados</span></div></div>
 <section className={styles.info}><strong>Base para a fidelidade</strong><p>Quando houver campanha ativa, somente pedidos realmente concluidos poderao contar. Pedido criado, cancelado ou ainda em andamento nao vira recompensa automaticamente.</p></section>
 <section className={styles.pending}><span>FIDELIDADE</span><strong>Nenhuma campanha ativa no momento</strong><p>Nao vamos inventar cupom, premio ou saldo. Quando uma campanha for configurada pela loja, ela aparecera aqui com regra e beneficio claros.</p></section></>}
 </div></ModalBase>
}
