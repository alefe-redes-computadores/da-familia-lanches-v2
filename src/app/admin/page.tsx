"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ChefHat,
  ClipboardList,
  History,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { OrderCard } from "@/components/layout/OrderCard";
import { prepareOrderSummaryTransition } from "@/lib/rewards";
import { updateOrderStatus } from "@/lib/orderRepository";
import { evaluateStoreStatus } from "@/lib/storeSchedule";
import { useAdminStoreSettings } from "@/hooks/useAdminStoreSettings";
import { normalizarStatus } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";
import { adminOrderSearchText, compareOperationalOrders, ageLabel, operationalAttention } from "@/lib/adminOrders";
import styles from "./admin.module.css";
import { haptic } from "@/lib/haptics";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";
import { OperationHealthAdmin } from "@/components/admin/OperationHealthAdmin";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import { AdminQuickStoreControl } from "@/components/admin/AdminQuickStoreControl";
import { useAdminFeedback } from "@/components/admin/ui/AdminExperienceProvider";
import { AdminLoadingState } from "@/components/admin/ui/AdminState";


const AdminPanelLoading = () => <AdminLoadingState label="Carregando painel" compact />;

const RelatoriosAdmin = dynamic(() => import("@/components/layout/RelatoriosAdmin").then((mod) => mod.RelatoriosAdmin), { loading: AdminPanelLoading });
const CatalogAdmin = dynamic(() => import("@/components/admin/CatalogAdmin").then((mod) => mod.CatalogAdmin), { loading: AdminPanelLoading });
const StoreOperationAdmin = dynamic(() => import("@/components/admin/StoreOperationAdmin").then((mod) => mod.StoreOperationAdmin), { loading: AdminPanelLoading });
const SchedulingAdmin = dynamic(() => import("@/components/admin/SchedulingAdmin").then((mod) => mod.SchedulingAdmin), { loading: AdminPanelLoading });
const RewardsAdmin = dynamic(() => import("@/components/admin/RewardsAdmin").then((mod) => mod.RewardsAdmin), { loading: AdminPanelLoading });
const CouponsAdmin = dynamic(() => import("@/components/admin/CouponsAdmin").then((mod) => mod.CouponsAdmin), { loading: AdminPanelLoading });
const PublicPromotionsAdmin = dynamic(() => import("@/components/admin/PublicPromotionsAdmin").then((mod) => mod.PublicPromotionsAdmin), { loading: AdminPanelLoading });
const FirestoreBudgetAdmin = dynamic(() => import("@/components/admin/FirestoreBudgetAdmin").then((mod) => mod.FirestoreBudgetAdmin), { loading: AdminPanelLoading });
const CustomerExperienceAdmin = dynamic(() => import("@/components/admin/CustomerExperienceAdmin").then((mod) => mod.CustomerExperienceAdmin), { loading: AdminPanelLoading });
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

type Tab = "cozinha" | "agendados" | "expedicao" | "concluidos" | "cancelados" | "catalogo" | "operacao" | "agendamentos" | "frete" | "cupons" | "fidelidade" | "gestao";
type ServiceFilter = "todos" | "delivery" | "pickup";

const normalizeSearch = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();


type AdminIconName =
  | "orders"
  | "kitchen"
  | "dispatch"
  | "calendar"
  | "history"
  | "management"
  | "health"
  | "store"
  | "bell"
  | "search";

function AdminIcon({ name }: { name: AdminIconName }) {
  const props = { size: 19, strokeWidth: 1.8, "aria-hidden": true as const };

  if (name === "orders") return <ClipboardList {...props} />;
  if (name === "kitchen") return <ChefHat {...props} />;
  if (name === "dispatch") return <Truck {...props} />;
  if (name === "calendar") return <CalendarDays {...props} />;
  if (name === "history") return <History {...props} />;
  if (name === "management") return <SlidersHorizontal {...props} />;
  if (name === "health") return <Activity {...props} />;
  if (name === "store") return <Store {...props} />;
  if (name === "bell") return <Bell {...props} />;
  return <Search {...props} />;
}

function AdminPageContent() {
  const searchParams = useSearchParams();
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
    reconhecerPedido,
    desfazerReconhecimentoPedido,
  } = useAdminOrders(currentUser, ADMINS);
  const [tab, setTab] = useState<Tab>("cozinha");
  const authorized = Boolean(currentUser?.email && ADMINS.includes(currentUser.email));
  const { settings: adminStoreSettings } = useAdminStoreSettings(authorized);
  const storeStatus = useMemo(() => evaluateStoreStatus(adminStoreSettings), [adminStoreSettings]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [storeQuickOpen, setStoreQuickOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("todos");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const { show: showFeedback } = useAdminFeedback();
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});
  const actionLocksRef = useRef<Set<string>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [unreadStages, setUnreadStages] = useState({ cozinha: false, expedicao: false });
  const previousStageCounts = useRef<{ cozinha: number; expedicao: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const urlOrderAppliedRef = useRef<string>("");

  useEffect(() => {
    const requestedStage = searchParams.get("stage");
    const requestedOrder = searchParams.get("order");
    const allowedStages: Tab[] = ["cozinha", "agendados", "expedicao", "concluidos", "cancelados", "catalogo"];

    if (requestedStage && allowedStages.includes(requestedStage as Tab)) {
      setTab(requestedStage as Tab);
      setAttentionOnly(false);
    }

    if (requestedOrder && urlOrderAppliedRef.current !== requestedOrder) {
      urlOrderAppliedRef.current = requestedOrder;
      setSelectedOrderId(requestedOrder);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);


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

  const operationalPedidos = useMemo(
    () => pedidos.map((pedido) => {
      const optimistic = optimisticStatuses[String(pedido.id)];

      if (
        !optimistic ||
        normalizarStatus(pedido.status) === optimistic
      ) {
        return pedido;
      }

      return {
        ...pedido,
        status: optimistic,
      };
    }),
    [pedidos, optimisticStatuses],
  );

  useEffect(() => {
    setOptimisticStatuses((current) => {
      let changed = false;
      const next = { ...current };

      for (const pedido of pedidos) {
        const id = String(pedido.id);
        const expected = current[id];

        if (
          expected &&
          normalizarStatus(pedido.status) === expected
        ) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [pedidos]);

  const updateStatus = async (
    id: string,
    status: string,
    pedido?: Record<string, unknown>,
    cancellation?: Parameters<typeof updateOrderStatus>[0]["cancellation"],
  ) => {
    const locks = actionLocksRef.current;

    // Lock síncrono: impede dois taps antes mesmo do React rerenderizar.
    if (locks.has(id)) return;
    locks.add(id);

    const nextLabel = normalizarStatus(status);
    const previousLabel = normalizarStatus(
      typeof pedido?.status === "string"
        ? pedido.status
        : undefined,
    );

    if (
      pedido &&
      previousLabel !== nextLabel
    ) {
      setOptimisticStatuses((current) => ({
        ...current,
        [id]: nextLabel,
      }));
    }

    const alarmAcknowledged =
      previousLabel === "Pendente";

    if (alarmAcknowledged) {
      reconhecerPedido(id);
    } else if (previousLabel === "Agendado") {
      pararAlarme();
    }

    setUpdatingOrderId(id);
    showFeedback({
      tone: "progress",
      title: "Atualizando pedido",
      message: `Movendo o pedido para ${nextLabel}…`,
    });
    haptic("step");

    try {
      const rewardPlan =
        pedido &&
        (
          nextLabel === "Finalizado" ||
          nextLabel === "Cancelado"
        )
          ? await prepareOrderSummaryTransition(
              pedido,
              nextLabel,
            )
          : null;

      const result = await updateOrderStatus({
        orderId: id,
        nextStatus: status,
        pickup: pedido?.tipoEntrega === "pickup",
        rewardPlan,
        ...(cancellation ? { cancellation } : {}),
      });

      showFeedback({
        tone: result.changed ? "success" : "info",
        title: result.rewardAwarded
          ? "Pedido concluído + fidelidade"
          : result.changed
            ? "Pedido atualizado"
            : "Etapa já confirmada",
        message: result.rewardAwarded
          ? "Pedido concluído e benefício de fidelidade liberado."
          : result.changed
            ? `Pedido atualizado para ${nextLabel}.`
            : "Este pedido já estava nesta etapa.",
      });

      haptic("success");

      // O snapshot autoritativo deve substituir o estado otimista rapidamente.
      // Este timeout impede override visual preso em caso de conectividade ruim.
      window.setTimeout(() => {
        setOptimisticStatuses((current) => {
          if (!(id in current)) return current;

          const next = { ...current };
          delete next[id];
          return next;
        });
      }, 5000);
    } catch (error) {
      if (alarmAcknowledged) {
        desfazerReconhecimentoPedido(id);
      }

      setOptimisticStatuses((current) => {
        if (!(id in current)) return current;

        const next = { ...current };
        delete next[id];
        return next;
      });

      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message.startsWith(
          "ORDER_STATUS_CONFLICT:",
        )
      ) {
        const transition = message.slice(
          "ORDER_STATUS_CONFLICT:".length,
        );

        const current =
          transition.split("->")[0] || "";

        showFeedback({
          tone: "info",
          title: "Fila sincronizada",
          message: current
            ? `Pedido já está em "${current}". A fila foi atualizada com o estado mais recente.`
            : "O pedido mudou de etapa em outro fluxo. A fila foi atualizada.",
        });
      } else {
        showFeedback({
          tone: "error",
          title: "Não foi possível atualizar",
          message: message
            ? `O pedido foi preservado. ${message.slice(0, 180)}`
            : "O pedido foi preservado. Tente novamente em instantes.",
        });
      }

      haptic("error");
    } finally {
      locks.delete(id);

      setUpdatingOrderId(
        (current) =>
          current === id
            ? null
            : current,
      );
    }
  };

  const counts = useMemo(() => ({
    pendentes: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Pendente",
    ).length,
    producao: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Em Produção",
    ).length,
    agendados: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Agendado",
    ).length,
    prontos: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Pronto",
    ).length,
    rota: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Saiu para Entrega",
    ).length,
    cozinha: operationalPedidos.filter((p) =>
      ["Pendente", "Em Produção"].includes(
        normalizarStatus(p.status),
      ),
    ).length,
    expedicao: operationalPedidos.filter((p) =>
      ["Pronto", "Saiu para Entrega"].includes(
        normalizarStatus(p.status),
      ),
    ).length,
    concluidos: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Finalizado",
    ).length,
    cancelados: operationalPedidos.filter(
      (p) => normalizarStatus(p.status) === "Cancelado",
    ).length,
    attention: operationalPedidos.filter(
      (p) => Boolean(operationalAttention(p, now)),
    ).length,
  }), [operationalPedidos, now]);

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
    return operationalPedidos
      .filter((pedido) => {
        const status = normalizarStatus(pedido.status);
        const inTab = attentionOnly
          ? ["Pendente", "Em Produção", "Pronto", "Saiu para Entrega"].includes(status)
          : tab === "cozinha" ? ["Pendente", "Em Produção"].includes(status) :
          tab === "agendados" ? status === "Agendado" :
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
  }, [operationalPedidos, search, tab, serviceFilter, attentionOnly, now]);

  const queueDensity =
    filtered.length >= 9
      ? "rush"
      : filtered.length >= 5
        ? "compact"
        : "comfortable";

  const priorityOrder =
    operationalPedidos.find(
      (pedido) =>
        ["Pendente", "Em Produção", "Pronto", "Saiu para Entrega"].includes(
          normalizarStatus(pedido.status),
        ) && Boolean(operationalAttention(pedido, now)),
    ) ?? null;

  const selectedOrder = useMemo(
    () =>
      operationalPedidos.find(
        (pedido) => String(pedido.id) === String(selectedOrderId || ""),
      ) ?? null,
    [operationalPedidos, selectedOrderId],
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
    ["agendados", "Agendados", counts.agendados],
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

  const isOrderTab = ["cozinha", "agendados", "expedicao", "concluidos", "cancelados"].includes(tab);

  const nextOpenLabel =
    "nextOpenLabel" in storeStatus &&
    typeof storeStatus.nextOpenLabel === "string"
      ? storeStatus.nextOpenLabel
      : "";

  const storeDetail =
    !storeStatus.isOpen && nextOpenLabel
      ? `Abre ${nextOpenLabel}`
      : storeStatus.message;

  const storeState = storeStatus.mode === "test_open"
    ? { label: "Manutenção", tone: "maintenance", detail: storeStatus.message }
    : storeStatus.isOpen
      ? {
          label: "Aberta",
          tone: "open",
          detail:
            storeStatus.source === "manual"
              ? "Abertura manual"
              : "Atendimento em andamento",
        }
      : { label: "Fechada", tone: "closed", detail: storeDetail };
  const managementActive = ["cancelados","catalogo","operacao","agendamentos","frete","cupons","fidelidade","gestao"].includes(tab);
  const activeOrders = counts.cozinha + counts.agendados + counts.expedicao;

  const queueContext = (() => {
    if (attentionOnly) {
      return {
        eyebrow: "ATENÇÃO",
        title: "Pedidos que pedem ação",
        detail: counts.attention > 0
          ? `${counts.attention} ${counts.attention === 1 ? "pedido precisa" : "pedidos precisam"} de atenção agora.`
          : "Nenhum pedido precisa de atenção agora.",
      };
    }

    if (tab === "cozinha") {
      return {
        eyebrow: "OPERAÇÃO",
        title: "Cozinha",
        detail: counts.cozinha > 0
          ? `${counts.pendentes} novo(s) · ${counts.producao} em preparo`
          : "Fila limpa. Novos pedidos aparecem aqui em tempo real.",
      };
    }

    if (tab === "agendados") {
      return {
        eyebrow: "AGENDA",
        title: "Agendados",
        detail: counts.agendados > 0
          ? `${counts.agendados} ${counts.agendados === 1 ? "pedido programado" : "pedidos programados"}`
          : "Nenhum pedido futuro aguardando produção.",
      };
    }

    if (tab === "expedicao") {
      return {
        eyebrow: "SAÍDA",
        title: "Expedição",
        detail: counts.expedicao > 0
          ? `${counts.prontos} pronto(s) · ${counts.rota} em rota`
          : "Nenhum pedido aguardando saída ou em rota.",
      };
    }

    if (tab === "concluidos") {
      return {
        eyebrow: "HISTÓRICO",
        title: "Concluídos",
        detail: "Pedidos finalizados carregados no histórico.",
      };
    }

    return {
      eyebrow: "HISTÓRICO",
      title: "Cancelados",
      detail: "Pedidos cancelados carregados no histórico.",
    };
  })();
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
          <button type="button" data-stage-active={tab === "agendados"} onClick={() => { setTab("agendados"); setAttentionOnly(false); }}>
            <span className={styles.railIcon}><AdminIcon name="calendar" /></span>
            <span>Agendados</span>
            {counts.agendados > 0 && <b>{counts.agendados}</b>}
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

      <div className={styles.workspace} data-mode={isOrderTab ? "operation" : "management"}>
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
              onClick={() => { haptic("step"); setStoreQuickOpen(true); }}
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
              onClick={() => setNotificationCenterOpen(true)}
              aria-label={counts.attention > 0 ? `Abrir notificações. ${counts.attention} pedidos precisam de atenção` : "Abrir central de notificações"}
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
            <span><strong>DA FAMÍLIA</strong><small>{desktopDate} · {desktopTime}</small></span>
          </div>
          <div className={styles.mobileTopActions}>
            <button type="button" className={styles.mobileBell} data-active={counts.attention > 0} onClick={() => setNotificationCenterOpen(true)} aria-label="Abrir central de notificações">
              <AdminIcon name="bell" />{counts.attention > 0 && <b>{counts.attention}</b>}
            </button>
          <button
            type="button"
            className={styles.mobileStore}
            data-tone={storeState.tone}
            onClick={() => { haptic("step"); setStoreQuickOpen(true); }}
            aria-label={`Loja ${storeState.label}. ${storeState.detail}`}
          >
            <i />
            <span><b>{storeState.label}</b><small>{storeStatus.mode === "test_open" ? "teste" : storeStatus.source === "manual" ? "manual" : "agenda"}</small></span>
          </button>
          </div>
        </header>

        <section
          className={styles.operationHero}
          data-tone={storeState.tone}
          data-attention={counts.attention > 0}
        >
          <div className={styles.operationHeroMain}>
            <span className={styles.operationEyebrow}>
              {counts.attention > 0 ? "ATENÇÃO AGORA" : activeOrders > 0 ? "OPERAÇÃO AGORA" : "OPERAÇÃO TRANQUILA"}
            </span>

            <div className={styles.operationHeroTitle}>
              <strong>
                {counts.attention > 0
                  ? `${counts.attention} ${counts.attention === 1 ? "pedido precisa" : "pedidos precisam"} de ação`
                  : activeOrders > 0
                    ? `${activeOrders} ${activeOrders === 1 ? "pedido ativo" : "pedidos ativos"}`
                    : "Fila zerada"}
              </strong>
            </div>

            <small>
              {counts.attention > 0 && priorityOrder
                ? `${String(priorityOrder.userName || priorityOrder.nomeCliente || priorityOrder.customerName || "Pedido")} · ${ageLabel(priorityOrder)}`
                : storeStatus.isOpen
                  ? storeState.detail
                  : `Loja ${storeState.label.toLowerCase()} · ${storeState.detail}`}
            </small>

            <button
              type="button"
              className={styles.operationHeroSignal}
              data-attention={counts.attention > 0}
              disabled={!priorityOrder}
              onClick={() => {
                if (!priorityOrder) return;
                setAttentionOnly(true);
                setSelectedOrderId(String(priorityOrder.id));
              }}
            >
              <span>
                {counts.attention > 0 ? "PRIORIDADE" : storeStatus.isOpen ? "FLUXO SOB CONTROLE" : "STATUS DA LOJA"}
              </span>
              <strong>
                {counts.attention > 0
                  ? "Abrir pedido que precisa de atenção"
                  : activeOrders > 0
                    ? `${counts.producao} preparando · ${counts.prontos} pronto(s) · ${counts.rota} em rota`
                    : "Aguardando novos pedidos"}
              </strong>
            </button>
          </div>

          <div className={styles.operationHeroStats} aria-label="Distribuição da operação">
            <button type="button" onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
              <b>{counts.pendentes}</b><span>Novos</span>
            </button>
            <button type="button" onClick={() => { setTab("cozinha"); setAttentionOnly(false); }}>
              <b>{counts.producao}</b><span>Preparo</span>
            </button>
            <button type="button" onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
              <b>{counts.prontos}</b><span>Prontos</span>
            </button>
            <button type="button" onClick={() => { setTab("expedicao"); setAttentionOnly(false); }}>
              <b>{counts.rota}</b><span>Em rota</span>
            </button>
          </div>
        </section>

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

          <button type="button" className={styles.metricCard} onClick={() => { setTab("agendados"); setAttentionOnly(false); }}>
            <span className={styles.metricIcon}><AdminIcon name="calendar" /></span>
            <b>{counts.agendados}</b>
            <strong>Agendados</strong>
            <small>{counts.agendados > 0 ? "Pedidos futuros" : "Agenda livre"}</small>
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
              data-active={tab === "agendados"}
              onClick={() => { setTab("agendados"); setAttentionOnly(false); }}
            >
              <AdminIcon name="calendar" />
              <span>Agendados</span>
              <b>{counts.agendados}</b>
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
                <button key={key} data-active={tab === key} onClick={() => { haptic("step"); setTab(key); setAttentionOnly(false); }}>
                  <AdminIcon name={key === "operacao" ? "store" : key === "agendamentos" ? "calendar" : key === "frete" ? "dispatch" : key === "gestao" ? "management" : key === "cancelados" ? "history" : "orders"} />
                  <span>{key === "operacao" ? "Loja" : key === "frete" ? "Entrega" : key === "gestao" ? "Saúde" : label}</span>
                  {key === "operacao" && <small>{storeState.label}</small>}
                  {key === "cancelados" && counts.cancelados > 0 && <small>{counts.cancelados}</small>}
                </button>
              ))}
              <button
                type="button"
                className={styles.managementNotifications}
                data-attention={counts.attention > 0}
                onClick={() => { haptic("step"); setNotificationCenterOpen(true); }}
              >
                <AdminIcon name="bell" />
                <span>Notificações</span>
                <small>{counts.attention > 0 ? `${counts.attention} atenção` : "Preferências"}</small>
              </button>
            </div>
          </section>
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
          <section className={styles.management}><div className={styles.sectionHeading}><div><span>CENTRAL DE PROMOÇÕES</span><h2>Campanhas & cupons</h2></div><p>Crie descontos, defina pedido mínimo e período, pause campanhas e escolha quais ofertas podem aparecer ao cliente.</p></div><CouponsAdmin /><PublicPromotionsAdmin /></section>
        ) : tab === "fidelidade" ? (
          <section className={styles.management}><div className={styles.sectionHeading}><div><span>FIDELIDADE</span><h2>Campanha de recompensas</h2></div><p>Configure benefícios reais. Apenas pedidos finalizados contam.</p></div><RewardsAdmin /></section>
        ) : tab === "gestao" ? (
          <section className={styles.management}><div className={styles.sectionHeading}><div><span>SAÚDE DA OPERAÇÃO</span><h2>Saúde da loja</h2></div><p>Exceções operacionais, pressão de leituras e indicadores comerciais sem novas assinaturas em tempo real.</p></div><OperationHealthAdmin pedidos={pedidos} historyHasMore={historyHasMore} /><CustomerExperienceAdmin /><FirestoreBudgetAdmin /><RelatoriosAdmin pedidos={pedidos} /></section>
        ) : isOrderTab ? (
          <>
            <div className={styles.queueHead}>
              <div>
                <span>{queueContext.eyebrow}</span>
                <h2>{queueContext.title}</h2>
                <p>{queueContext.detail}</p>
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
              <div className={styles.grid} data-density={queueDensity}>
                {filtered.length
                  ? filtered.map((pedido) => (
                      <OrderCard
                        key={pedido.id}
                        pedido={pedido}
                        updateStatus={updateStatus}
                        imprimirPedido={imprimirPedido}
                        selected={selectedOrderId === pedido.id}
                        updating={updatingOrderId === pedido.id}
                        density={queueDensity}
                        onSelect={() => setSelectedOrderId(pedido.id)}
                      />
                    ))
                  : <div className={styles.empty} data-tab={tab}>
                      <span className={styles.emptyIcon}><AdminIcon name={tab === "agendados" ? "calendar" : tab === "expedicao" ? "dispatch" : tab === "concluidos" ? "history" : "orders"} /></span>
                      <strong>{search || attentionOnly || serviceFilter !== "todos" ? "Nenhum resultado com estes filtros." : tab === "cozinha" ? "Cozinha zerada." : tab === "agendados" ? "Agenda sem pedidos." : tab === "expedicao" ? "Expedição limpa." : "Nenhum pedido carregado."}</strong>
                      <span>{search || attentionOnly || serviceFilter !== "todos" ? "Limpe a busca ou ajuste os filtros para ampliar a fila." : tab === "cozinha" ? "Quando chegar um novo pedido ele aparece aqui imediatamente." : tab === "agendados" ? "Pedidos programados aparecem aqui ordenados por horário." : tab === "expedicao" ? "Pedidos prontos e em rota aparecem aqui." : "O histórico será exibido conforme os pedidos forem carregados."}</span>
                    </div>}
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
      <AdminNotificationCenter
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        attentionCount={counts.attention}
      />
      <AdminQuickStoreControl
        open={storeQuickOpen}
        settings={adminStoreSettings}
        stateLabel={storeState.label}
        stateDetail={storeState.detail}
        onClose={() => setStoreQuickOpen(false)}
        onOpenFull={() => setTab("operacao")}
      />
    </main>
  );
}


export default function AdminPage() {
  return (
    <Suspense fallback={<AdminPanelLoading />}>
      <AdminPageContent />
    </Suspense>
  );
}
