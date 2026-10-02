"use client";
import dynamic from "next/dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { OrderCard } from "@/components/layout/OrderCard";
import { prepareOrderSummaryTransition } from "@/lib/rewards";
import { updateOrderStatus } from "@/lib/orderRepository";
import { evaluateStoreStatus } from "@/lib/storeSchedule";
import { useAdminStoreSettings } from "@/hooks/useAdminStoreSettings";
import { normalizarStatus } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";
import { adminOrderSearchText, compareOperationalOrders, operationalAttention } from "@/lib/adminOrders";
import styles from "./admin.module.css";
import { haptic } from "@/lib/haptics";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";
import { OperationHealthAdmin } from "@/components/admin/OperationHealthAdmin";


const AdminPanelLoading = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      minHeight: 120,
      display: "grid",
      placeItems: "center",
      opacity: 0.72,
      fontSize: 14,
    }}
  >
    Carregando painel…
  </div>
);

const RelatoriosAdmin = dynamic(() => import("@/components/layout/RelatoriosAdmin").then((mod) => mod.RelatoriosAdmin), { loading: AdminPanelLoading });
const CatalogAdmin = dynamic(() => import("@/components/admin/CatalogAdmin").then((mod) => mod.CatalogAdmin), { loading: AdminPanelLoading });
const StoreOperationAdmin = dynamic(() => import("@/components/admin/StoreOperationAdmin").then((mod) => mod.StoreOperationAdmin), { loading: AdminPanelLoading });
const SchedulingAdmin = dynamic(() => import("@/components/admin/SchedulingAdmin").then((mod) => mod.SchedulingAdmin), { loading: AdminPanelLoading });
const RewardsAdmin = dynamic(() => import("@/components/admin/RewardsAdmin").then((mod) => mod.RewardsAdmin), { loading: AdminPanelLoading });
const CouponsAdmin = dynamic(() => import("@/components/admin/CouponsAdmin").then((mod) => mod.CouponsAdmin), { loading: AdminPanelLoading });
const PublicPromotionsAdmin = dynamic(() => import("@/components/admin/PublicPromotionsAdmin").then((mod) => mod.PublicPromotionsAdmin), { loading: AdminPanelLoading });
const FirestoreBudgetAdmin = dynamic(() => import("@/components/admin/FirestoreBudgetAdmin").then((mod) => mod.FirestoreBudgetAdmin), { loading: AdminPanelLoading });
const FreeDeliveryAdmin = dynamic(() => import("@/components/admin/FreeDeliveryAdmin").then((mod) => mod.FreeDeliveryAdmin), { loading: AdminPanelLoading });
const DeliveryRatesAdmin = dynamic(() => import("@/components/admin/DeliveryRatesAdmin").then((mod) => mod.DeliveryRatesAdmin), { loading: AdminPanelLoading });

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
type FeedbackState = { tone: "progress" | "success" | "error" | "info"; title: string; message: string } | null;

const normalizeSearch = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();


type AdminIconName =
  | "orders"
  | "kitchen"
  | "dispatch"
  | "history"
  | "management"
  | "health"
  | "store"
  | "bell"
  | "search";

function AdminIcon({ name }: { name: AdminIconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "orders") {
    return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4.5h6M9 9h6M9 13h6M9 17h4" /></svg>;
  }
  if (name === "kitchen") {
    return <svg {...common}><path d="M5 11h14l-1 7H6l-1-7Z" /><path d="M8 11V8a4 4 0 0 1 8 0v3M4 20h16" /></svg>;
  }
  if (name === "dispatch") {
    return <svg {...common}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
  }
  if (name === "history") {
    return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2M4 7V3m0 0h4" /></svg>;
  }
  if (name === "management") {
    return <svg {...common}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 5v4M8 15v4M16 5v4M16 15v4" /></svg>;
  }
  if (name === "health") {
    return <svg {...common}><path d="M3 12h4l2.2-5 4.2 10 2.1-5H21" /></svg>;
  }
  if (name === "store") {
    return <svg {...common}><path d="M4 9h16l-1-5H5L4 9Z" /><path d="M6 9v10h12V9M9 19v-5h6v5" /></svg>;
  }
  if (name === "bell") {
    return <svg {...common}><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9Z" /><path d="M10 19h4" /></svg>;
  }
  return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>;
}

export default function AdminPage() {
  const { currentUser } = useAuthStore();
  const {
    pedidos,
    loading,
    historyLoading,
    historyHasMore,
    historyError,
    historySearchLoading,
    refreshHistory,
    loadMoreHistory,
    searchHistoryIdentifier,
    alarmeAtivo,
    pararAlarme,
  } = useAdminOrders(currentUser, ADMINS);
  const [tab, setTab] = useState<Tab>("cozinha");
  const authorized = Boolean(currentUser?.email && ADMINS.includes(currentUser.email));
  const { settings: adminStoreSettings } = useAdminStoreSettings(authorized);
  const storeStatus = useMemo(() => evaluateStoreStatus(adminStoreSettings), [adminStoreSettings]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("todos");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [unreadStages, setUnreadStages] = useState({ cozinha: false, expedicao: false });
  const previousStageCounts = useRef<{ cozinha: number; expedicao: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());



  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!feedback || feedback.tone === "progress") return;
    const timer = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (tab !== "concluidos" && tab !== "cancelados") return;
    void refreshHistory();
  }, [tab, refreshHistory]);
  useEffect(() => {
    if (tab !== "concluidos" && tab !== "cancelados") return;
    const term=search.trim(); if(term.length<4)return;
    const timer=window.setTimeout(()=>void searchHistoryIdentifier(term),550);
    return ()=>window.clearTimeout(timer);
  },[tab,search,searchHistoryIdentifier]);

  const updateStatus = async (id: string, status: string, pedido?: Record<string, unknown>) => {
    if (updatingOrderId === id) return;
    setUpdatingOrderId(id);
    const nextLabel = normalizarStatus(status);
    setFeedback({ tone: "progress", title: "Atualizando pedido", message: `Movendo o pedido para ${nextLabel}…` });
    haptic("step");
    try {
      const normalizedNext=normalizarStatus(status);
      const rewardPlan = pedido && (normalizedNext === "Finalizado" || normalizedNext === "Cancelado")
        ? await prepareOrderSummaryTransition(pedido,normalizedNext)
        : null;
      const result = await updateOrderStatus({
        orderId: id,
        nextStatus: status,
        pickup: pedido?.tipoEntrega === "pickup",
        rewardPlan,
      });
      setFeedback({
        tone: result.changed ? "success" : "info",
        title: result.rewardAwarded ? "Pedido concluído + fidelidade" : result.changed ? "Pedido atualizado" : "Etapa já confirmada",
        message: result.rewardAwarded
          ? "Pedido concluído e benefício de fidelidade liberado."
          : result.changed
            ? `Pedido atualizado para ${normalizarStatus(status)}.`
            : "Este pedido já estava nesta etapa.",
      });
      haptic("success");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("ORDER_STATUS_CONFLICT:")) {
        const transition = message.slice("ORDER_STATUS_CONFLICT:".length);
        const current = transition.split("->")[0] || "";
        setFeedback({ tone: "info", title: "Fila sincronizada", message: current
          ? `Pedido já está em "${current}". A fila foi atualizada com o estado mais recente.`
          : "O pedido mudou de etapa em outro fluxo. A fila foi atualizada." });
      } else {
        setFeedback({ tone: "error", title: "Não foi possível atualizar", message: "O pedido foi preservado. Tente novamente em instantes." });
      }
      haptic("error");
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

  useEffect(() => {
    const previous = previousStageCounts.current;
    if (previous) {
      if (counts.cozinha > previous.cozinha && tab !== "cozinha") {
        setUnreadStages((value) => ({ ...value, cozinha: true }));
      }
      if (counts.expedicao > previous.expedicao && tab !== "expedicao") {
        setUnreadStages((value) => ({ ...value, expedicao: true }));
      }
    }
    previousStageCounts.current = { cozinha: counts.cozinha, expedicao: counts.expedicao };
  }, [counts.cozinha, counts.expedicao, tab]);

  useEffect(() => {
    if (tab === "cozinha") setUnreadStages((value) => value.cozinha ? ({ ...value, cozinha: false }) : value);
    if (tab === "expedicao") setUnreadStages((value) => value.expedicao ? ({ ...value, expedicao: false }) : value);
  }, [tab]);

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

  const selectedOrder = useMemo(
    () => pedidos.find((pedido) => pedido.id === selectedOrderId) ?? null,
    [pedidos, selectedOrderId],
  );

  useEffect(() => {
    if (!selectedOrder) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !updatingOrderId) setSelectedOrderId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedOrder, updatingOrderId]);

  if (!currentUser) {
    return <AdminAuthGate />;
  }

  if (!authorized) {
    return (
      <AdminAuthGate
        deniedEmail={currentUser.email}
      />
    );
  }
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
  const storeState = storeStatus.mode === "test_open"
    ? { label: "Manutenção", tone: "maintenance", detail: storeStatus.message }
    : storeStatus.isOpen
      ? { label: "Aberta", tone: "open", detail: storeStatus.source === "manual" ? "Abertura manual" : storeStatus.message }
      : { label: "Fechada", tone: "closed", detail: storeStatus.message };
  const managementActive = ["cancelados","catalogo","operacao","agendamentos","frete","cupons","fidelidade","gestao"].includes(tab);
  const activeOrders = counts.cozinha + counts.expedicao;
  const currentMoment = new Date(now);
  const desktopDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  }).format(currentMoment).replace(".", "");
  const desktopTime = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentMoment);
  const adminInitial = String(currentUser.email || "A").trim().charAt(0).toUpperCase() || "A";

  return (
    <main className={styles.page}>
      <aside className={styles.desktopRail} aria-label="Navegação administrativa">
        <div className={styles.railBrand}>
          <div className={styles.railMark} aria-hidden="true" />
          <div>
            <strong>DA FAMÍLIA</strong>
            <span>LANCHES</span>
          </div>
        </div>

        <nav className={styles.railNav}>
          <button type="button" data-active={isOrderTab} onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="orders" /></span>
            <span>Pedidos</span>
            {activeOrders > 0 && <b>{activeOrders}</b>}
          </button>
          <button type="button" data-stage-active={tab === "cozinha"} data-unread={unreadStages.cozinha} onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="kitchen" /></span>
            <span>Cozinha</span>
            {counts.cozinha > 0 && <b>{counts.cozinha}</b>}
          </button>
          <button type="button" data-stage-active={tab === "expedicao"} data-unread={unreadStages.expedicao} onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="dispatch" /></span>
            <span>Expedição</span>
            {counts.expedicao > 0 && <b>{counts.expedicao}</b>}
          </button>
          <button type="button" data-stage-active={tab === "concluidos"} onClick={() => { setTab("concluidos"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="history" /></span>
            <span>Histórico</span>
          </button>
          <button type="button" data-active={managementActive && tab !== "gestao"} onClick={() => { setTab("operacao"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="management" /></span>
            <span>Gestão</span>
          </button>
          <button type="button" data-active={tab === "gestao"} onClick={() => { setTab("gestao"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="health" /></span>
            <span>Saúde da operação</span>
          </button>
        </nav>

        <button type="button" className={styles.railStatus} data-tone={storeState.tone} onClick={() => setTab("operacao")}>
          <i />
          <span>
            <b>Loja {storeState.label}</b>
            <small>{storeState.detail}</small>
          </span>
        </button>
      </aside>

      <div className={styles.workspace}>
        {alarmeAtivo && (
          <button className={styles.alarm} onClick={pararAlarme}>
            NOVO PEDIDO <span>toque para silenciar</span>
          </button>
        )}

        <header className={styles.desktopToolbar}>
          <div className={styles.toolbarLeft}>
            <button
              type="button"
              className={styles.storeControl}
              data-tone={storeState.tone}
              onClick={() => setTab("operacao")}
              aria-label={`Loja ${storeState.label}. ${storeState.detail}`}
              title={storeState.detail}
            >
              <span className={styles.storeIcon}><AdminIcon name="store" /></span>
              <b>{storeState.label}</b>
              <span className={styles.storeChevron}>⌄</span>
            </button>
            <div className={styles.clock}>
              <span>{desktopDate}</span>
              <i />
              <b>{desktopTime}</b>
            </div>
          </div>

          <div className={styles.toolbarRight}>
            <button
              type="button"
              className={styles.notificationButton}
              data-active={counts.attention > 0}
              onClick={() => {
                setTab("cozinha");
                setAttentionOnly(true);
              }}
              aria-label={counts.attention > 0 ? `${counts.attention} pedidos precisam de atenção` : "Nenhum pedido precisa de atenção"}
            >
              <AdminIcon name="bell" />
              {counts.attention > 0 && <b>{counts.attention}</b>}
            </button>
            <div className={styles.adminIdentity}>
              <span>{adminInitial}</span>
              <div>
                <b>Admin</b>
                <small>{currentUser.email}</small>
              </div>
            </div>
          </div>
        </header>

        <header className={styles.mobileTopbar}>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileBrandMark} aria-hidden="true" />
            <strong>Da Família</strong>
          </div>
          <button
            type="button"
            className={styles.mobileStore}
            data-tone={storeState.tone}
            onClick={() => setTab("operacao")}
            aria-label={`Loja ${storeState.label}. ${storeState.detail}`}
          >
            <i />
            <span><b>{storeState.label}</b><small>{storeStatus.mode === "test_open" ? "teste" : storeStatus.source === "manual" ? "manual" : "agenda"}</small></span>
          </button>
        </header>

        <section className={styles.overviewGrid} aria-label="Visão geral da operação">
          <button
            type="button"
            className={`${styles.metricCard} ${styles.metricLead}`}
            onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}
          >
            <span className={styles.metricIcon}><AdminIcon name="orders" /></span>
            <b>{activeOrders}</b>
            <strong>Pedidos em andamento</strong>
            <small data-attention={counts.attention > 0}>
              {counts.attention > 0 ? `${counts.attention} precisam de atenção` : "Fila sob controle"}
            </small>
          </button>

          <button type="button" className={styles.metricCard} onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
            <span className={styles.metricIcon}><AdminIcon name="history" /></span>
            <b>{counts.pendentes}</b>
            <strong>Novos</strong>
            <small>{counts.pendentes > 0 ? "Aguardando aceite" : "Sem pendências"}</small>
          </button>

          <button type="button" className={styles.metricCard} onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
            <span className={styles.metricIcon}><AdminIcon name="kitchen" /></span>
            <b>{counts.producao}</b>
            <strong>Em preparo</strong>
            <small>{counts.producao > 0 ? "Na cozinha" : "Sem pedidos"}</small>
          </button>

          <button type="button" className={styles.metricCard} onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
            <span className={styles.metricIcon}><AdminIcon name="orders" /></span>
            <b>{counts.prontos}</b>
            <strong>Prontos</strong>
            <small>{counts.prontos > 0 ? "Aguardando expedição" : "Sem pedidos"}</small>
          </button>

          <button type="button" className={styles.metricCard} onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
            <span className={styles.metricIcon}><AdminIcon name="dispatch" /></span>
            <b>{counts.rota}</b>
            <strong>Em rota</strong>
            <small>{counts.rota > 0 ? "Com entregadores" : "Sem entregas"}</small>
          </button>
        </section>

        <section className={styles.operationBar}>
          <nav className={styles.primaryNav} aria-label="Operação">
            <button
              type="button"
              data-active={tab === "cozinha"}
              data-unread={unreadStages.cozinha}
              onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}
            >
              <AdminIcon name="kitchen" />
              <span>Cozinha</span>
              <b>{counts.cozinha}</b>
            </button>
            <button
              type="button"
              data-active={tab === "expedicao"}
              data-unread={unreadStages.expedicao}
              onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}
            >
              <AdminIcon name="dispatch" />
              <span>Expedição</span>
              <b>{counts.expedicao}</b>
            </button>
            <button
              type="button"
              data-active={tab === "concluidos"}
              onClick={() => { setTab("concluidos"); setAttentionOnly(false); }}
            >
              <AdminIcon name="history" />
              <span>Histórico</span>
              <b>{counts.concluidos}</b>
            </button>
            <button
              type="button"
              data-active={managementActive}
              onClick={() => {
                if (!managementActive) setTab("operacao");
                window.requestAnimationFrame(() =>
                  document.getElementById("admin-management")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                );
              }}
            >
              <AdminIcon name="management" />
              <span>Gestão</span>
            </button>
          </nav>

          {isOrderTab ? (
            <label className={styles.desktopSearch}>
              <AdminIcon name="search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar pedido, cliente..."
              />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}
            </label>
          ) : (
            <div className={styles.managementContext}>
              <span>GESTÃO DA LOJA</span>
              <b>{storeState.label}</b>
            </div>
          )}
        </section>

        {managementActive && (
          <section id="admin-management" className={styles.managementHub} aria-label="Gestão da loja">
            <div className={styles.managementHubHead}>
              <div><span>GESTÃO</span><strong>Controles da loja</strong></div>
              <small>{storeState.label} · {storeStatus.source === "manual" ? "controle manual" : storeStatus.source === "exception" ? "exceção" : "agenda automática"}</small>
            </div>
            <div className={styles.managementNav}>
              {tabItems.filter(([key]) => ["operacao","catalogo","agendamentos","frete","cupons","fidelidade","gestao","cancelados"].includes(key)).map(([key,label]) => (
                <button key={key} data-active={tab === key} onClick={() => { setTab(key); setAttentionOnly(false); }}>
                  <span>{key === "operacao" ? "Loja" : key === "frete" ? "Entrega" : key === "gestao" ? "Saúde" : label}</span>
                  {key === "operacao" && <small>{storeState.label}</small>}
                  {key === "cancelados" && counts.cancelados > 0 && <small>{counts.cancelados}</small>}
                </button>
              ))}
            </div>
          </section>
        )}

        {feedback && (
          <div className={styles.toast} data-tone={feedback.tone} role="status" aria-live="polite">
            <i />
            <div>
              <strong>{feedback.title}</strong>
              <span>{feedback.message}</span>
            </div>
            {feedback.tone !== "progress" && <button type="button" onClick={() => setFeedback(null)} aria-label="Fechar aviso">×</button>}
          </div>
        )}

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
          <section className={styles.management}><div className={styles.sectionHeading}><div><span>SAÚDE DA OPERAÇÃO</span><h2>Saúde da loja</h2></div><p>Exceções operacionais, pressão de leituras e indicadores comerciais sem novas assinaturas em tempo real.</p></div><OperationHealthAdmin pedidos={pedidos} historyHasMore={historyHasMore} /><FirestoreBudgetAdmin /><RelatoriosAdmin pedidos={pedidos} /></section>
        ) : isOrderTab ? (
          <>
            <div className={styles.queueHead}>
              <div>
                <span>{tab === "cozinha" ? "AGORA" : tab === "expedicao" ? "SAÍDA" : "HISTÓRICO"}</span>
                <h2>{attentionOnly ? "Precisam de atenção" : tabItems.find(([key]) => key === tab)?.[1]}</h2>
              </div>
              <b className={(tab === "concluidos" || tab === "cancelados") ? styles.historyCount : undefined}>{filtered.length}{(tab === "concluidos" || tab === "cancelados") ? <span>pedidos</span> : null}</b>
            </div>

            <div className={styles.queueTools}>
              <button
                type="button"
                className={styles.searchTrigger}
                data-active={searchOpen || Boolean(search)}
                onClick={() => setSearchOpen((value) => !value)}
                aria-label={searchOpen ? "Fechar busca" : "Buscar pedido"}
                title="Buscar pedido"
              >
                <AdminIcon name="search" /><b>Buscar</b>
              </button>
              <div className={styles.filters}>
                <button data-active={serviceFilter === "todos"} onClick={() => setServiceFilter("todos")}>Todos</button>
                <button data-active={serviceFilter === "delivery"} onClick={() => setServiceFilter("delivery")}>Entrega</button>
                <button data-active={serviceFilter === "pickup"} onClick={() => setServiceFilter("pickup")}>Retirada</button>
                <button className={styles.attentionFilter} data-active={attentionOnly} onClick={() => setAttentionOnly((value) => !value)}>
                  {attentionOnly ? "Voltar" : "Atenção"} {counts.attention > 0 && <b>{counts.attention}</b>}
                </button>
              </div>
            </div>

            {(searchOpen || search) && (
              <label className={styles.search} data-open="true">
                <span>Buscar pedido</span>
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cliente, telefone, pedido ou endereço"
                />
                <button type="button" onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Fechar busca">×</button>
              </label>
            )}

            <div className={styles.orderWorkspace} data-inspector-open={Boolean(selectedOrder)}>
              <div className={styles.grid}>
                {filtered.length
                  ? filtered.map((pedido) => (
                      <OrderCard
                        key={pedido.id}
                        pedido={pedido}
                        updateStatus={updateStatus}
                        imprimirPedido={imprimirPedido}
                        selected={selectedOrderId === pedido.id}
                        updating={updatingOrderId === pedido.id}
                        onSelect={() => setSelectedOrderId(pedido.id)}
                      />
                    ))
                  : <div className={styles.empty}><strong>Nenhum pedido aqui.</strong><span>{search || attentionOnly || serviceFilter !== "todos" ? "Tente limpar os filtros." : "A fila está limpa nesta etapa."}</span></div>}
              </div>

              {selectedOrder && (
                <>
                  <button type="button" disabled={Boolean(updatingOrderId)} className={styles.sheetBackdrop} aria-label="Fechar detalhes" onClick={() => setSelectedOrderId(null)} />
                  <aside className={styles.orderInspector} role="dialog" aria-modal="true" aria-label="Detalhes do pedido">
                    <div className={styles.inspectorHead}>
                      <div><span>PEDIDO SELECIONADO</span><strong>Detalhes e ações</strong></div>
                      <button type="button" disabled={Boolean(updatingOrderId)} onClick={() => setSelectedOrderId(null)} aria-label="Fechar detalhes">×</button>
                    </div>
                    <OrderCard
                      pedido={selectedOrder}
                      updateStatus={updateStatus}
                      imprimirPedido={imprimirPedido}
                      forceExpanded
                      inspector
                      updating={updatingOrderId === selectedOrder.id}
                    />
                  </aside>
                </>
              )}
            </div>

            {(tab === "concluidos" || tab === "cancelados") && (
              <div className={styles.loadMore} data-error={Boolean(historyError)}>
                {historyLoading ? (
                  <div className={styles.historyProgress}><span /><b>Carregando pedidos...</b></div>
                ) : historyError ? (
                  <>
                    <span className={styles.historyMessage}>{historyError}</span>
                    <button type="button" onClick={() => void refreshHistory()}>Tentar novamente</button>
                  </>
                ) : historyHasMore ? (
                  <button type="button" onClick={() => void loadMoreHistory()}>Carregar mais 20 pedidos</button>
                ) : (
                  <span className={styles.historyEnd}>Fim do histórico carregado.</span>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
