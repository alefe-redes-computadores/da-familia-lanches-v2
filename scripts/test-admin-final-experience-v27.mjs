import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V27: ${message}`);
};

const page = read("src/app/admin/page.tsx");
const css = read("src/app/admin/admin.module.css");
const card = read("src/components/layout/OrderCard.tsx");
const cardCss = read("src/components/layout/OrderCard.module.css");
const hook = read("src/hooks/useAdminOrders.ts");

ok(page.includes("const queueContext = useMemo"), "contexto inteligente da fila");
ok(page.includes("operationHeroSignal"), "sinal operacional do hero");
ok(page.includes("queueContext.detail"), "descrição contextual da fila");
ok(page.includes("emptyIcon"), "estado vazio contextual");
ok(card.includes("summaryMeta"), "resumo premium do card");
ok(card.includes("fulfillmentLabel"), "modalidade destacada");
ok(card.includes("itemCount"), "contagem de itens central");
ok(css.includes("V27 — FINAL EXPERIENCE"), "CSS final do Admin");
ok(css.includes("position: sticky"), "navegação sticky mobile");
ok(css.includes("grid-template-columns: repeat(2"), "métricas mobile 2 colunas");
ok(cardCss.includes("V27 — ORDER CARD FINAL EXPERIENCE"), "CSS final dos cards");
ok((hook.match(/onSnapshot\s*\(/g) || []).length === 1, "listener único preservado");
ok(page.includes('searchParams.get("order")'), "deep-link interno preservado");
ok(card.includes("Abrir no Entregas"), "ponte DFL Entregas preservada");

console.log("V27 ADMIN FINAL EXPERIENCE — ZERO ERROS");
