"use client";

import { useMemo } from "react";
import { useCustomerOrderCount } from "@/hooks/useCustomerOrderCount";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import { ModalBase } from "./ModalBase";
import styles from "./RewardsModal.module.css";

const milestones = [5, 10, 20, 50];

export function RewardsModal() {
  const closeModal = useUIStore((state) => state.closeModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { count: ordersCount, loading } = useCustomerOrderCount();
  const next = useMemo(() => milestones.find((target) => target > ordersCount) ?? milestones[milestones.length - 1], [ordersCount]);
  const progress = Math.min(100, (ordersCount / next) * 100);

  return (
    <ModalBase title="Seu progresso" onClose={closeModal}>
      <div className={styles.wrap}>
        <div className={styles.hero}><span>HISTÓRICO NA SUA CONTA</span><strong>{loading ? "—" : ordersCount}</strong><p>{ordersCount === 1 ? "pedido registrado" : "pedidos registrados"}. Seu histórico ajuda a deixar os próximos pedidos mais rápidos.</p></div>
        <div className={styles.progressCard}><div><b>Próximo marco</b><span>{ordersCount}/{next}</span></div><div className={styles.track}><i style={{ width: `${progress}%` }} /></div><small>{ordersCount >= next ? "Marco alcançado." : `Faltam ${next - ordersCount} pedido${next - ordersCount === 1 ? "" : "s"} para o próximo marco.`}</small></div>
        <div className={styles.milestones}>{milestones.map((target) => { const reached = ordersCount >= target; return <div key={target} className={reached ? styles.reached : styles.pending}><b>{target}</b><span>{reached ? "Marco alcançado" : "Em progresso"}</span></div>; })}</div>
        <div className={styles.notice}><b>Sem promessa que o sistema não possa cumprir.</b><p>Este número representa pedidos vinculados à sua conta — não saldo financeiro nem cupom. Benefícios só aparecem aqui quando estiverem realmente cadastrados e válidos.</p></div>
        {!currentUser && <div className={styles.notice}><b>Entre para acompanhar.</b><p>O histórico fica vinculado à conta usada no pedido.</p></div>}
      </div>
    </ModalBase>
  );
}
