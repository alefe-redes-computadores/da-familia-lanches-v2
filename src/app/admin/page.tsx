"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { OrderCard } from "@/components/layout/OrderCard";
import { RelatoriosAdmin } from "@/components/layout/RelatoriosAdmin";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";
import { StoreOperationAdmin } from "@/components/admin/StoreOperationAdmin";
import { RewardsAdmin } from "@/components/admin/RewardsAdmin";
import { CouponsAdmin } from "@/components/admin/CouponsAdmin";
import { PublicPromotionsAdmin } from "@/components/admin/PublicPromotionsAdmin";
import { prepareRewardForFinalizedOrder } from "@/lib/rewards";
import { updateOrderStatus } from "@/lib/orderRepository";
import { evaluateStoreStatus, normalizeStoreSettings } from "@/lib/storeSchedule";
import { normalizarStatus } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";
import { adminOrderSearchText, compareOperationalOrders, operationalAttention } from "@/lib/adminOrders";
import styles from "./admin.module.css";

const ADMINS = [
  "alefejohsefe@gmail.com",
  "kalebhstanley650@gmail.com",
  "contato@dafamilialanches.com.br",
  "carols2maite@gmail.com",
  "degustbolosnopote@gmail.com",
  "viniciusrdefreitas@gmail.com",
];

type Tab = "cozinha" | "expedicao" | "concluidos" | "cancelados" | "catalogo" | "operacao" | "cupons" | "fidelidade" | "gestao";
type ServiceFilter = "todos" | "delivery" | "pickup";

const normalizeSearch = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function AdminPage() {
  const { currentUser } = useAuthStore();
  const { pedidos, loading, alarmeAtivo, pararAlarme } = useAdminOrders(currentUser, ADMINS);
  const [tab, setTab] = useState<Tab>("cozinha");
  const [storeOpen, setStoreOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("todos");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const authorized = Boolean(currentUser?.email && ADMINS.includes(currentUser.email));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(doc(db, "settings", "loja"), (snapshot) => {
      if (snapshot.exists()) setStoreOpen(evaluateStoreStatus(normalizeStoreSettings(snapshot.data())).isOpen);
    });
  }, [authorized]);

  const updateStatus = async (id: string, status: string, pedido?: Record<string, unknown>) => {
    try {
      const rewardPlan = status === "Finalizado" && pedido
        ? await prepareRewardForFinalizedOrder(pedido)
        : null;
      const result = await updateOrderStatus({
        orderId: id,
        nextStatus: status,
        pickup: pedido?.tipoEntrega === "pickup",
        rewardPlan,
      });
      setFeedback(result.rewardAwarded
        ? "Pedido concluído e benefício de fidelidade liberado."
        : `Pedido atualizado para ${normalizarStatus(status)}.`);
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível atualizar o pedido. O status pode ter mudado em outro aparelho.");
    }
  };

  const counts = useMemo(() => ({
    pendentes: pedidos.filter((p) => normalizarStatus(p.status) === "Pendente").length,
    producao: pedidos.filter((p) => normalizarStatus(p.status) === "Em Produção").length,
    agendados: pedidos.filter((p) => normalizarStatus(p.status) === "Agendado").length,
    prontos: pedidos.filter((p) => normalizarStatus(p.status) === "Pronto").length,
    rota: pedidos.filter((p) => normalizarStatus(p.status) === "Saiu para Entrega").length,
    cozinha: pedidos.filter((p) => ["Pendente", "Em Produção", "Agendado"].includes(normalizarStatus(p.status))).length,
    expedicao: pedidos.filter((p) => ["Pronto", "Saiu para Entrega"].includes(normalizarStatus(p.status))).length,
    concluidos: pedidos.filter((p) => normalizarStatus(p.status) === "Finalizado").length,
    cancelados: pedidos.filter((p) => normalizarStatus(p.status) === "Cancelado").length,
    attention: pedidos.filter((p) => Boolean(operationalAttention(p, now))).length,
  }), [pedidos, now]);

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return pedidos
      .filter((pedido) => {
        const status = normalizarStatus(pedido.status);
        const inTab =
          tab === "cozinha" ? ["Pendente", "Em Produção", "Agendado"].includes(status) :
          tab === "expedicao" ? ["Pronto", "Saiu para Entrega"].includes(status) :
          tab === "concluidos" ? status === "Finalizado" :
          tab === "cancelados" ? status === "Cancelado" :
          false;
        if (!inTab) return false;
        if (serviceFilter === "pickup" && pedido.tipoEntrega !== "pickup") return false;
        if (serviceFilter === "delivery" && pedido.tipoEntrega === "pickup") return false;
        if (attentionOnly && !operationalAttention(pedido, now)) return false;
        if (term && !adminOrderSearchText(pedido).includes(term)) return false;
        return true;
      })
      .sort(compareOperationalOrders);
  }, [pedidos, search, tab, serviceFilter, attentionOnly, now]);

  if (!currentUser) return <div className={styles.statePage}><strong>Central administrativa</strong><span>Entre com uma conta autorizada para continuar.</span></div>;
  if (!authorized) return <div className={styles.statePage}><strong>Acesso negado</strong><span>Esta conta não possui permissão administrativa.</span></div>;
  if (loading) return <div className={styles.statePage}><strong>Carregando operação...</strong></div>;

  const tabItems: Array<[Tab, string, number | null]> = [
    ["cozinha", "Cozinha", counts.cozinha],
    ["expedicao", "Expedição", counts.expedicao],
    ["concluidos", "Concluídos", counts.concluidos],
    ["cancelados", "Cancelados", counts.cancelados],
    ["catalogo", "Cardápio", null],
    ["operacao", "Funcionamento", null],
    ["cupons", "Cupons", null],
    ["fidelidade", "Fidelidade", null],
    ["gestao", "Relatórios", null],
  ];

  const isOrderTab = ["cozinha", "expedicao", "concluidos", "cancelados"].includes(tab);

  return (
    <main className={styles.page}>
      {alarmeAtivo && <button className={styles.alarm} onClick={pararAlarme}>NOVO PEDIDO <span>toque para silenciar</span></button>}

      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <div className={styles.adminMark}><span>DFL</span><b>OPERAÇÃO</b></div>
          <div className={styles.account}>{currentUser.email}</div>
        </div>

        <div className={styles.heroTop}>
          <div>
            <span className={styles.eyebrow}>CENTRAL ADMINISTRATIVA</span>
            <h1>Operação de hoje</h1>
            <p>{counts.cozinha} na cozinha · {counts.expedicao} na expedição</p>
          </div>
          <button className={styles.store} data-open={storeOpen} onClick={() => setTab("operacao")}>
            <i />{storeOpen ? "Loja aberta" : "Loja fechada"}
          </button>
        </div>

        <div className={styles.pulse}>
          <button onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}><span>Recebidos</span><b>{counts.pendentes}</b></button>
          <button onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}><span>Em preparo</span><b>{counts.producao}</b></button>
          <button onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}><span>Prontos</span><b>{counts.prontos}</b></button>
          <button onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}><span>Em rota</span><b>{counts.rota}</b></button>
          <button onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}><span>Agendados</span><b>{counts.agendados}</b></button>
          <button data-alert={counts.attention > 0} onClick={() => { setTab("cozinha"); setAttentionOnly(true); }}><span>Sem atualização</span><b>{counts.attention}</b></button>
        </div>

        <nav className={styles.tabs} aria-label="Etapas da operação">
          {tabItems.map(([key, label, count]) => (
            <button key={key} className={styles.tab} data-active={tab === key} onClick={() => { setTab(key); setAttentionOnly(false); }}>
              <span>{label}</span>{count !== null && <b>{count}</b>}
            </button>
          ))}
        </nav>
      </header>

      {feedback && <div className={styles.feedback}>{feedback}<button onClick={() => setFeedback("")}>Fechar</button></div>}

      {tab === "catalogo" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>CATÁLOGO</span><h2>Cardápio da loja</h2></div><p>Edite o catálogo remoto sem alterar pedidos já realizados.</p></div><CatalogAdmin /></section>
      ) : tab === "operacao" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>OPERAÇÃO</span><h2>Funcionamento da loja</h2></div><p>Agenda automática, controle manual e exceções.</p></div><StoreOperationAdmin /></section>
      ) : tab === "cupons" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>PROMOÇÕES</span><h2>Cupons de desconto</h2></div><p>Crie, agende, pause e edite cupons sem mexer diretamente no banco.</p></div><CouponsAdmin /><PublicPromotionsAdmin /></section>
      ) : tab === "fidelidade" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>FIDELIDADE</span><h2>Campanha de recompensas</h2></div><p>Configure benefícios reais. Apenas pedidos finalizados contam.</p></div><RewardsAdmin /></section>
      ) : tab === "gestao" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>DESEMPENHO</span><h2>Relatórios da loja</h2></div><p>Somente pedidos finalizados entram nos indicadores comerciais.</p></div><RelatoriosAdmin pedidos={pedidos} /></section>
      ) : isOrderTab ? (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarTitle}>
              <strong>{tabItems.find(([key]) => key === tab)?.[1]}</strong>
              <span>{filtered.length} pedido{filtered.length === 1 ? "" : "s"} nesta visualização</span>
            </div>
            <label className={styles.search}>
              <span>Buscar</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, telefone, pedido ou endereço" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}
            </label>
          </div>

          <div className={styles.filters}>
            <button data-active={serviceFilter === "todos"} onClick={() => setServiceFilter("todos")}>Todos</button>
            <button data-active={serviceFilter === "delivery"} onClick={() => setServiceFilter("delivery")}>Entrega</button>
            <button data-active={serviceFilter === "pickup"} onClick={() => setServiceFilter("pickup")}>Retirada</button>
            <button className={styles.attentionFilter} data-active={attentionOnly} onClick={() => setAttentionOnly((value) => !value)}>
              Sem atualização {counts.attention > 0 && <b>{counts.attention}</b>}
            </button>
          </div>

          <div className={styles.grid}>
            {filtered.length
              ? filtered.map((pedido) => <OrderCard key={pedido.id} pedido={pedido} updateStatus={updateStatus} imprimirPedido={imprimirPedido} />)
              : <div className={styles.empty}><strong>Nenhum pedido aqui.</strong><span>{search || attentionOnly || serviceFilter !== "todos" ? "Tente limpar os filtros." : "A fila está limpa nesta etapa."}</span></div>}
          </div>
        </>
      ) : null}
    </main>
  );
}
