/** V89 — filtro puramente local, sem novas consultas ou listeners. */
export type StageFocus = "all" | "pendentes" | "producao" | "prontos" | "rota";
export function stageFocusForTab(focus: StageFocus, tab: string): StageFocus {
  if (tab === "cozinha" && (focus === "pendentes" || focus === "producao")) return focus;
  if (tab === "expedicao" && (focus === "prontos" || focus === "rota")) return focus;
  return "all";
}
export function orderMatchesStageFocus(focus: StageFocus, status: string): boolean {
  if (focus === "all") return true;
  return (focus === "pendentes" && status === "Pendente") ||
    (focus === "producao" && status === "Em Produção") ||
    (focus === "prontos" && status === "Pronto") ||
    (focus === "rota" && status === "Saiu para Entrega");
}
