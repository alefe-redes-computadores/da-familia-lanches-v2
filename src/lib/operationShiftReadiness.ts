/** R41 - Diagnostico de abertura: somente leitura, sem dados pessoais nem IO. */
export type ShiftLevel = "ok" | "review" | "unknown";
export type ShiftSignal = { id: string; label: string; level: ShiftLevel; detail: string };
export type ShiftInput = {
  activeOrders: number;
  attentionOrders: number;
  historyHasMore: boolean;
  remoteState: "healthy" | "attention" | "quarantine" | null;
  checkedAt: string | null;
  nowMs: number;
  remoteError: boolean;
  outboxPending: number | null;
  outboxProcessing: number | null;
  outboxFailed: number | null;
  outboxDead: number | null;
  messagingPending: number | null;
  messagingProcessing: number | null;
  messagingQuarantined: number | null;
  humanInboxChecked: boolean;
  humanStorefrontChecked: boolean;
  humanCatalogChecked: boolean;
  humanHoursChecked: boolean;
};
export const SHIFT_SNAPSHOT_TTL_MS = 5 * 60_000;
const safeCount = (value: number | null): number | null => value === null || !Number.isFinite(value) || value < 0 ? null : Math.floor(value);
export function inspectShiftReadiness(input: ShiftInput) {
  const checkedMs = input.checkedAt ? Date.parse(input.checkedAt) : NaN;
  const snapshotFresh = Boolean(!input.remoteError && input.remoteState !== null && Number.isFinite(checkedMs)
    && Number.isFinite(input.nowMs) && checkedMs <= input.nowMs + 30_000
    && input.nowMs - checkedMs <= SHIFT_SNAPSHOT_TTL_MS);
  const outbox = [input.outboxPending, input.outboxProcessing, input.outboxFailed, input.outboxDead].map(safeCount);
  const messaging = [input.messagingPending, input.messagingProcessing, input.messagingQuarantined].map(safeCount);
  const allCountsKnown = outbox.every(v => v !== null) && messaging.every(v => v !== null);
  const pending = (outbox[0] ?? 0) + (outbox[1] ?? 0) + (messaging[0] ?? 0) + (messaging[1] ?? 0);
  const failures = (outbox[2] ?? 0) + (outbox[3] ?? 0) + (messaging[2] ?? 0);
  const transportGood = snapshotFresh && allCountsKnown && input.remoteState === "healthy" && pending === 0 && failures === 0;
  const signals: ShiftSignal[] = [
    { id: "orders", label: "Pedidos em andamento", level: input.attentionOrders > 0 || input.activeOrders > 0 ? "review" : "ok",
      detail: input.attentionOrders > 0 ? `${input.attentionOrders} pedido(s) precisam de atenção.` : input.activeOrders > 0 ? `${input.activeOrders} pedido(s) em andamento. Confira a fila.` : "Sem pedidos em andamento entre os registros carregados." },
    { id: "history", label: "Cobertura da lista", level: input.historyHasMore ? "unknown" : "ok",
      detail: input.historyHasMore ? "Histórico paginado: a lista carregada não representa todos os pedidos." : "Sem mais páginas no histórico consultado. Isto não valida outros sistemas." },
    { id: "transport", label: "Transporte Site → Entregas", level: !snapshotFresh || !allCountsKnown ? "unknown" : input.remoteState === "healthy" && pending === 0 && failures === 0 ? "ok" : "review",
      detail: !snapshotFresh ? input.remoteError ? "Consulta falhou; o resultado anterior não é atual." : "Clique em Verificar: consulta ausente ou com mais de 5 minutos." : !allCountsKnown ? "Contagens indisponíveis; não é possível atestar a fila." : failures ? `${failures} falha(s) ou evento(s) em quarentena; revisar antes de abrir.` : pending ? `${pending} evento(s) pendente(s) ou em processamento; acompanhar.` : "Sem pendências no transporte consultado; não comprova entrada no aplicativo Entregas." },
    { id: "storefront", label: "Site público acessível", level: input.humanStorefrontChecked ? "ok" : "unknown",
      detail: input.humanStorefrontChecked ? "Conferência manual feita nesta sessão." : "Abra o site no celular e confira se o catálogo e o carrinho aparecem." },
    { id: "catalog", label: "Preços e disponibilidade", level: input.humanCatalogChecked ? "ok" : "unknown",
      detail: input.humanCatalogChecked ? "Conferência manual feita nesta sessão." : "Confira no painel produtos principais, preços, disponibilidade e adicionais." },
    { id: "hours", label: "Loja e horários", level: input.humanHoursChecked ? "ok" : "unknown",
      detail: input.humanHoursChecked ? "Conferência manual feita nesta sessão." : "Confirme o estado efetivo da loja, agenda de amanhã e eventuais exceções." },
    { id: "destination", label: "Caixa de Entrada do Entregas", level: input.humanInboxChecked ? "ok" : "unknown",
      detail: input.humanInboxChecked ? "Conferência manual marcada nesta sessão; nenhuma confirmação automática do destino foi inferida." : "Confira um pedido autorizado no aplicativo Entregas e marque abaixo; ausência de backlog não é confirmação." },
  ];
  const reviews = signals.filter(s => s.level === "review").length;
  const unknowns = signals.filter(s => s.level === "unknown").length;
  return { signals, reviews, unknowns, snapshotFresh, transportGood,
    level: reviews > 0 ? "review" as ShiftLevel : unknowns > 0 ? "unknown" as ShiftLevel : "ok" as ShiftLevel,
    headline: reviews > 0 ? `${reviews} ponto(s) exigem atenção` : unknowns > 0 ? `${unknowns} conferência(s) pendente(s)` : "Conferências registradas nesta sessão",
  };
}
export function formatShiftReport(input: ShiftInput, result: ReturnType<typeof inspectShiftReadiness>): string {
  const at = Number.isFinite(input.nowMs) ? new Date(input.nowMs).toISOString() : "indefinido";
  return [
    "DFL SITE | CONFERENCIA OPERACIONAL R41",
    `Consulta local: ${at}`,
    `Snapshot remoto: ${input.checkedAt || "nao consultado"}`,
    `Situacao: ${result.headline}`,
    ...result.signals.map(s => `[${s.level.toUpperCase()}] ${s.label}: ${s.detail}`),
    "Atenção: não contém pedidos nem dados pessoais. Não comprova recebimento no Entregas sem conferência humana.",
  ].join("\n");
}
