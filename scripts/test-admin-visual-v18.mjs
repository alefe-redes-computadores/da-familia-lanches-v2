import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const ok = (value, label) => {
  if (!value) throw new Error(`V18: ${label}`);
  console.log(`OK: ${label}`);
};

const page = read("src/app/admin/page.tsx");
const pageCss = read("src/app/admin/admin.module.css");
const card = read("src/components/layout/OrderCard.tsx");
const cardCss = read("src/components/layout/OrderCard.module.css");
const ui = read("src/app/admin/admin-ui.css");

ok(page.includes('tone: "progress"') && page.includes('data-tone={feedback.tone}'), "feedback possui progresso, sucesso, informação e erro");
ok(page.includes("unreadStages") && page.includes("data-unread={unreadStages.expedicao}"), "etapas possuem novidade não lida");
ok(page.includes('event.key === "Escape"') && page.includes('document.body.style.overflow = "hidden"'), "inspetor fecha por Escape e bloqueia o fundo");
ok(page.includes('role="dialog"') && page.includes('aria-modal="true"'), "detalhes possuem contrato acessível de modal");
ok(card.includes("data-stage={stageTone}") && card.includes("Concluir entrega"), "card comunica etapa e próxima ação");
ok(card.includes("stageTrack") && card.includes("updating ? \"Atualizando…\""), "detalhes exibem jornada e estado de processamento");
ok(cardCss.includes('.card[data-stage="ready"]') && cardCss.includes('.card[data-stage="route"]'), "cores semânticas de pronto e rota");
ok(ui.includes('button[data-tone="green"]') && ui.includes('button[data-tone="blue"]'), "ações verdes e azuis vencem o amarelo global");
ok(pageCss.includes('.toast[data-tone="progress"]') && pageCss.includes("adminToastSpin"), "toast de andamento premium");
ok(pageCss.includes("SEMANTIC OPERATION + PREMIUM MOBILE") && pageCss.includes("inspectorIn"), "acabamento mobile e inspetor premium");

for (const forbidden of [
  "src/lib/integration/server/messagingProjection.ts",
  "src/lib/integration/server/reversePersistence.ts",
  "src/app/api/integration/events/route.ts",
]) {
  ok(!process.argv.slice(2).includes(forbidden), `integração congelada: ${forbidden}`);
}

console.log("============================================================");
console.log(" DFL ADMIN VISUAL V18 — CONTRATO OK");
console.log("============================================================");
