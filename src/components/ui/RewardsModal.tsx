"use client";

import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCustomerOrderStats } from "@/hooks/useCustomerOrderStats";
import { useCustomerRewards } from "@/hooks/useCustomerRewards";
import type { CustomerReward } from "@/lib/rewards";
import styles from "./RewardsModal.module.css";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const benefit = (reward: CustomerReward) =>
  reward.discountType === "percent" ? `${reward.discountValue}% OFF` : `${money(reward.discountValue)} OFF`;

const expiry = (reward: CustomerReward) =>
  reward.expiresAt ? reward.expiresAt.toDate().toLocaleDateString("pt-BR") : "sem vencimento";

export function RewardsModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const stats = useCustomerOrderStats();
  const rewards = useCustomerRewards();

  const progress = rewards.config.everyOrders > 0 ? stats.completed % rewards.config.everyOrders : 0;
  const remaining = progress === 0 && stats.completed > 0
    ? rewards.config.everyOrders
    : Math.max(1, rewards.config.everyOrders - progress);
  const progressPercent = rewards.config.everyOrders > 0
    ? Math.min(100, (progress / rewards.config.everyOrders) * 100)
    : 0;

  return (
    <ModalBase title="Fidelidade Da Família" onClose={closeModal}>
      <div className={styles.body}>
        {!currentUser ? (
          <div className={styles.empty}><strong>Entre para ver sua fidelidade</strong><p>Seus benefícios ficam vinculados à sua conta.</p></div>
        ) : stats.loading || rewards.loading ? (
          <div className={styles.empty}><p>Carregando sua fidelidade…</p></div>
        ) : stats.error || rewards.error ? (
          <div className={styles.empty}><strong>Fidelidade indisponível agora</strong><p>{stats.error || rewards.error}</p></div>
        ) : (
          <>
            <section className={styles.hero}><span>PEDIDOS FINALIZADOS</span><strong>{stats.completed}</strong><p>Somente pedidos realmente concluídos entram na campanha.</p></section>

            {rewards.config.active ? (
              <section className={styles.campaign}>
                <div><span>CAMPANHA ATIVA</span><strong>{rewards.config.title}</strong><p>{rewards.config.description}</p></div>
                <div className={styles.progress}><i style={{ width: `${progressPercent}%` }} /></div>
                <small>{remaining} pedido{remaining === 1 ? "" : "s"} finalizado{remaining === 1 ? "" : "s"} até o próximo benefício.</small>
              </section>
            ) : (
              <section className={styles.pending}><span>FIDELIDADE</span><strong>Nenhuma campanha ativa no momento</strong><p>Seu histórico continua preservado. A loja não cria prêmio ou saldo fictício enquanto não houver campanha configurada.</p></section>
            )}

            {rewards.available.length > 0 && (
              <section className={styles.rewardSection}>
                <div className={styles.sectionTitle}><strong>Benefícios disponíveis</strong><span>{rewards.available.length}</span></div>
                <div className={styles.rewardList}>
                  {rewards.available.map((reward) => (
                    <article className={styles.rewardCard} key={reward.id}>
                      <div><span>{benefit(reward)}</span><strong>{reward.title}</strong><p>{reward.description}</p></div>
                      <div className={styles.code}><small>USE NO CHECKOUT</small><b>{reward.code}</b></div>
                      <footer><span>Válido até {expiry(reward)}</span>{reward.minOrder > 0 && <span>Pedido mínimo {money(reward.minOrder)}</span>}</footer>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className={styles.stats}>
              <div><strong>{stats.total}</strong><span>registrados</span></div>
              <div><strong>{rewards.used.length}</strong><span>benefícios usados</span></div>
              <div><strong>{stats.cancelled}</strong><span>cancelados</span></div>
            </div>

            <section className={styles.info}><strong>Como funciona</strong><p>O benefício nasce quando a loja marca o pedido que fecha um marco como Finalizado. Pedido criado, cancelado ou ainda em andamento não conta.</p></section>
          </>
        )}
      </div>
    </ModalBase>
  );
}
