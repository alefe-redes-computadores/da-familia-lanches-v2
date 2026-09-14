"use client";

import { useEffect, useMemo, useState } from "react";
import { arrayUnion, doc, onSnapshot, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { OrderCard } from "@/components/layout/OrderCard";
import { RelatoriosAdmin } from "@/components/layout/RelatoriosAdmin";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";
import { StoreOperationAdmin } from "@/components/admin/StoreOperationAdmin";
import { evaluateStoreStatus, normalizeStoreSettings } from "@/lib/storeSchedule";
import { normalizarStatus } from "@/lib/orderUtils";
import { imprimirPedido } from "@/lib/printOrder";
import styles from "./admin.module.css";

const ADMINS = ["alefejohsefe@gmail.com", "kalebhstanley650@gmail.com", "contato@dafamilialanches.com.br", "carols2maite@gmail.com", "degustbolosnopote@gmail.com"];

type Tab = "cozinha" | "expedicao" | "concluidos" | "cancelados" | "catalogo" | "operacao" | "gestao";

const normalizeSearch = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function AdminPage() {
  const { currentUser } = useAuthStore();
  const { pedidos, loading, alarmeAtivo, pararAlarme } = useAdminOrders(currentUser, ADMINS);
  const [tab, setTab] = useState<Tab>("cozinha");
  const [storeOpen, setStoreOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");

  const authorized = Boolean(currentUser?.email && ADMINS.includes(currentUser.email));

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(doc(db, "settings", "loja"), (snapshot) => {
      if (snapshot.exists()) setStoreOpen(evaluateStoreStatus(normalizeStoreSettings(snapshot.data())).isOpen);
    });
  }, [authorized]);

  const persistStatus = async (id: string, status: string) => {
    const now = Timestamp.now();
    await updateDoc(doc(db, "Pedidos", id), {
      status,
      statusUpdatedAt: now,
      statusHistory: arrayUnion({ status, at: now }),
    });
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await persistStatus(id, status);
      setFeedback("");
    } catch (error) {
      console.error(error);
      setFeedback("Nao foi possivel atualizar o pedido. Tente novamente.");
    }
  };

  const openStoreOperation = () => setTab("operacao");

  const counts = useMemo(() => ({
    cozinha: pedidos.filter((p) => ["Pendente", "Em Produção", "Agendado"].includes(normalizarStatus(p.status))).length,
    expedicao: pedidos.filter((p) => ["Pronto", "Saiu para Entrega"].includes(normalizarStatus(p.status))).length,
    concluidos: pedidos.filter((p) => normalizarStatus(p.status) === "Finalizado").length,
    cancelados: pedidos.filter((p) => normalizarStatus(p.status) === "Cancelado").length,
  }), [pedidos]);

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return pedidos.filter((pedido) => {
      const status = normalizarStatus(pedido.status);
      const inTab =
        tab === "cozinha" ? ["Pendente", "Em Produção", "Agendado"].includes(status) :
        tab === "expedicao" ? ["Pronto", "Saiu para Entrega"].includes(status) :
        tab === "concluidos" ? status === "Finalizado" :
        tab === "cancelados" ? status === "Cancelado" :
        false;

      if (!inTab) return false;
      if (!term) return true;
      return normalizeSearch([
        pedido.id,
        pedido.userName,
        pedido.userPhone,
        pedido.phone,
        pedido.endereco,
        pedido.metodoPagamento,
      ].join(" ")).includes(term);
    });
  }, [pedidos, search, tab]);

  if (!currentUser) return <div className={styles.statePage}><strong>Central administrativa</strong><span>Entre com uma conta autorizada para continuar.</span></div>;
  if (!authorized) return <div className={styles.statePage}><strong>Acesso negado</strong><span>Esta conta nao possui permissao administrativa.</span></div>;
  if (loading) return <div className={styles.statePage}><strong>Carregando operacao...</strong></div>;

  const tabItems: Array<[Tab, string, number | null]> = [
    ["cozinha", "Cozinha", counts.cozinha],
    ["expedicao", "Expedicao", counts.expedicao],
    ["concluidos", "Concluidos", counts.concluidos],
    ["cancelados", "Cancelados", counts.cancelados],
    ["catalogo", "Cardápio", null],
    ["operacao", "Funcionamento", null],
    ["gestao", "Relatórios", null],
  ];

  return (
    <main className={styles.page}>
      {alarmeAtivo && <button className={styles.alarm} onClick={pararAlarme}>NOVO PEDIDO <span>toque para silenciar</span></button>}

      <header className={styles.hero}>
        <div className={styles.brandRow}>
          <div className={styles.adminMark}><span>DFL</span><b>OPERACAO</b></div>
          <div className={styles.account}>{currentUser.email}</div>
        </div>

        <div className={styles.heroTop}>
          <div>
            <span className={styles.eyebrow}>CENTRAL ADMINISTRATIVA</span>
            <h1>Central de pedidos</h1>
            <p>{counts.cozinha} aguardando cozinha · {counts.expedicao} na expedicao</p>
          </div>
          <button className={styles.store} data-open={storeOpen} onClick={openStoreOperation}>
            <i />
            {storeOpen ? "Loja aberta" : "Loja fechada"}
          </button>
        </div>

        <nav className={styles.tabs} aria-label="Etapas da operacao">
          {tabItems.map(([key, label, count]) => (
            <button key={key} className={styles.tab} data-active={tab === key} onClick={() => setTab(key)}>
              <span>{label}</span>
              {count !== null && <b>{count}</b>}
            </button>
          ))}
        </nav>
      </header>

      {feedback && <div className={styles.feedback}>{feedback}<button onClick={() => setFeedback("")}>Fechar</button></div>}

      {tab === "catalogo" ? (
        <section className={styles.management}>
          <div className={styles.sectionHeading}>
            <div><span>CATÁLOGO</span><h2>Cardápio da loja</h2></div>
            <p>Edite o catálogo remoto sem alterar pedidos já realizados.</p>
          </div>
          <CatalogAdmin />
        </section>
      ) : tab === "operacao" ? (
        <section className={styles.management}>
          <div className={styles.sectionHeading}><div><span>OPERAÇÃO</span><h2>Funcionamento da loja</h2></div><p>Agenda automática, controle manual e exceções.</p></div>
          <StoreOperationAdmin />
        </section>
      ) : tab === "gestao" ? (
        <section className={styles.management}>
          <div className={styles.sectionHeading}>
            <div><span>DESEMPENHO</span><h2>Relatorios da loja</h2></div>
            <p>Somente pedidos finalizados entram nos indicadores comerciais.</p>
          </div>
          <RelatoriosAdmin pedidos={pedidos} />
        </section>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div>
              <strong>{tabItems.find(([key]) => key === tab)?.[1]}</strong>
              <span>{filtered.length} pedido{filtered.length === 1 ? "" : "s"} nesta visualizacao</span>
            </div>
            <label className={styles.search}>
              <span>Buscar</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, telefone ou pedido" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}
            </label>
          </div>

          <div className={styles.grid}>
            {filtered.length
              ? filtered.map((pedido) => <OrderCard key={pedido.id} pedido={pedido} updateStatus={updateStatus} imprimirPedido={imprimirPedido} />)
              : <div className={styles.empty}><strong>Nenhum pedido aqui.</strong><span>{search ? "Tente limpar a busca." : "A fila esta limpa nesta etapa."}</span></div>}
          </div>
        </>
      )}
    </main>
  );
}
