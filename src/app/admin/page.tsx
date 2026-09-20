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
import { SchedulingAdmin } from "@/components/admin/SchedulingAdmin";
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
import { FreeDeliveryAdmin } from "@/components/admin/FreeDeliveryAdmin";
import { DeliveryRatesAdmin } from "@/components/admin/DeliveryRatesAdmin";

const ADMINS = [
  "alefejohsefe@gmail.com",
  "kalebhstanley650@gmail.com",
  "contato@dafamilialanches.com.br",
  "carols2maite@gmail.com",
  "degustbolosnopote@gmail.com",
  "viniciusrdefreitas@gmail.com",
];

type Tab = "cozinha" | "expedicao" | "concluidos" | "cancelados" | "catalogo" | "operacao" | "agendamentos" | "frete" | "cupons" | "fidelidade" | "gestao";
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
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const authorized = Boolean(currentUser?.email && ADMINS.includes(currentUser.email));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("button")) return;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
    };
    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(doc(db, "settings", "loja"), (snapshot) => {
      if (snapshot.exists()) setStoreOpen(evaluateStoreStatus(normalizeStoreSettings(snapshot.data())).isOpen);
    });
  }, [authorized]);

  const updateStatus = async (id: string, status: string, pedido?: Record<string, unknown>) => {
    if (updatingOrderId === id) return;
    setUpdatingOrderId(id);
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
        : result.changed
          ? `Pedido atualizado para ${normalizarStatus(status)}.`
          : "Este pedido já estava nesta etapa.");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível atualizar o pedido. O status pode ter mudado em outro aparelho.");
    } finally {
      setUpdatingOrderId((current) => current === id ? null : current);
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
        const inTab = attentionOnly
          ? ["Pendente", "Em Produção", "Pronto", "Saiu para Entrega"].includes(status)
          : tab === "cozinha" ? ["Pendente", "Em Produção", "Agendado"].includes(status) :
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
    ["agendamentos", "Agendamentos", null],
    ["frete", "Entrega & frete", null],
    ["cupons", "Cupons", null],
    ["fidelidade", "Fidelidade", null],
    ["gestao", "Relatórios", null],
  ];

  const isOrderTab = ["cozinha", "expedicao", "concluidos", "cancelados"].includes(tab);

  return (
    <main className={styles.page}>
      {alarmeAtivo && <button className={styles.alarm} onClick={pararAlarme}>NOVO PEDIDO <span>toque para silenciar</span></button>}

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden="true" />
          <div>
            <strong>DFL Admin</strong>
            <span>Central da loja</span>
          </div>
        </div>

        <button
          className={styles.storePill}
          data-open={storeOpen}
          onClick={() => setTab("operacao")}
        >
          <i />
          {storeOpen ? "Aberta" : "Fechada"}
        </button>
      </header>

      <section className={styles.command}>
        <div className={styles.commandHead}>
          <div>
            <span>VISÃO GERAL</span>
            <h1>
              {counts.cozinha || counts.expedicao
                ? `${counts.cozinha + counts.expedicao} pedidos em andamento`
                : "Operação sob controle"}
            </h1>
          </div>

          {counts.attention > 0 && (
            <button
              className={styles.alertPill}
              onClick={() => {
                setTab("cozinha");
                setAttentionOnly(true);
              }}
            >
              {counts.attention} atenção
            </button>
          )}
        </div>

        <div className={styles.quickStats}>
          <button onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
            <b>{counts.pendentes}</b>
            <span>Novos</span>
          </button>

          <button onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
            <b>{counts.producao}</b>
            <span>Preparo</span>
          </button>

          <button onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
            <b>{counts.prontos}</b>
            <span>Prontos</span>
          </button>

          <button onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
            <b>{counts.rota}</b>
            <span>Em rota</span>
          </button>
        </div>
      </section>

      <nav className={styles.primaryNav} aria-label="Operação">
        {tabItems
          .filter(([key]) =>
            ["cozinha", "expedicao", "concluidos"].includes(key)
          )
          .map(([key, label, count]) => (
            <button
              key={key}
              data-active={tab === key}
              onClick={() => {
                setTab(key);
                setAttentionOnly(false);
              }}
            >
              <span>{key === "concluidos" ? "Histórico" : label}</span>
              {count !== null && <b>{count}</b>}
            </button>
          ))}

        <button
          data-active={[
            "cancelados",
            "catalogo",
            "operacao",
            "agendamentos",
            "frete",
            "cupons",
            "fidelidade",
            "gestao",
          ].includes(tab)}
          onClick={() => {
            document
              .getElementById("admin-management")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        >
          Gestão
        </button>
      </nav>

      <div id="admin-management" className={styles.managementNav}>
        {tabItems
          .filter(([key]) =>
            [
              "catalogo",
              "operacao",
              "agendamentos",
              "frete",
              "cupons",
              "fidelidade",
              "gestao",
              "cancelados",
            ].includes(key)
          )
          .map(([key, label]) => (
            <button
              key={key}
              data-active={tab === key}
              onClick={() => {
                setTab(key);
                setAttentionOnly(false);
              }}
            >
              {key === "operacao"
                ? "Loja"
                : key === "frete"
                  ? "Entrega"
                  : label}
            </button>
          ))}
      </div>

      {feedback && <div className={styles.feedback}>{feedback}<button onClick={() => setFeedback("")}>Fechar</button></div>}

      {tab === "catalogo" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>CATÁLOGO</span><h2>Cardápio da loja</h2></div><p>Edite o catálogo remoto sem alterar pedidos já realizados.</p></div><CatalogAdmin /></section>
      ) : tab === "operacao" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>FUNCIONAMENTO</span><h2>Loja agora & horários</h2></div><p>Abertura automática, forçada, modo de teste e agenda semanal.</p></div><StoreOperationAdmin /></section>
      ) : tab === "agendamentos" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>AGENDAMENTOS</span><h2>Pedidos futuros</h2></div><p>Intervalo, antecedência, horários disponíveis e capacidade por faixa.</p></div><SchedulingAdmin /></section>
      ) : tab === "frete" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>ENTREGA & FRETE</span><h2>Taxas e benefícios de entrega</h2></div><p>Taxa padrão, bairros e regras de frete grátis em um único lugar.</p></div><DeliveryRatesAdmin /><FreeDeliveryAdmin /></section>
      ) : tab === "cupons" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>PROMOÇÕES</span><h2>Cupons de desconto</h2></div><p>Crie, agende, pause e edite cupons sem mexer diretamente no banco.</p></div><CouponsAdmin /><PublicPromotionsAdmin /></section>
      ) : tab === "fidelidade" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>FIDELIDADE</span><h2>Campanha de recompensas</h2></div><p>Configure benefícios reais. Apenas pedidos finalizados contam.</p></div><RewardsAdmin /></section>
      ) : tab === "gestao" ? (
        <section className={styles.management}><div className={styles.sectionHeading}><div><span>DESEMPENHO</span><h2>Relatórios da loja</h2></div><p>Somente pedidos finalizados entram nos indicadores comerciais.</p></div><RelatoriosAdmin pedidos={pedidos} /></section>
      ) : isOrderTab ? (
        <>
          <div className={styles.queueHead}>
            <div>
              <span>
                {tab === "cozinha"
                  ? "AGORA"
                  : tab === "expedicao"
                    ? "SAÍDA"
                    : "HISTÓRICO"}
              </span>
              <h2>
                {attentionOnly
                  ? "Precisam de atenção"
                  : tabItems.find(([key]) => key === tab)?.[1]}
              </h2>
            </div>
            <b>{filtered.length}</b>
          </div>

          <label className={styles.search}>
            <span>Buscar pedido</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, telefone, pedido ou endereço"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
              >
                ×
              </button>
            )}
          </label>

          <div className={styles.filters}>
            <button data-active={serviceFilter === "todos"} onClick={() => setServiceFilter("todos")}>Todos</button>
            <button data-active={serviceFilter === "delivery"} onClick={() => setServiceFilter("delivery")}>Entrega</button>
            <button data-active={serviceFilter === "pickup"} onClick={() => setServiceFilter("pickup")}>Retirada</button>
            <button className={styles.attentionFilter} data-active={attentionOnly} onClick={() => setAttentionOnly((value) => !value)}>
              {attentionOnly ? "Voltar à etapa" : "Sem atualização"} {counts.attention > 0 && <b>{counts.attention}</b>}
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
