import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V34.2: ${message}`);
};

const page = read("src/app/admin/page.tsx");
const css = read("src/app/admin/admin.module.css");
const orders = read("src/hooks/useAdminOrders.ts");

ok(
  page.includes('`Abre ${nextOpenLabel}`'),
  "próxima abertura não ganhou semântica correta",
);

ok(
  page.includes("<strong>DA FAMÍLIA</strong>"),
  "marca mobile não foi atualizada",
);

ok(
  css.includes("V34.2 — MOBILE RESPONSIVENESS + STORE SEMANTICS"),
  "camada CSS V34.2 ausente",
);

ok(
  css.includes(".metricLead") &&
  css.includes("grid-template-columns:44px 48px minmax(0,1fr)"),
  "card principal não foi realinhado",
);

ok(
  css.includes(".overviewGrid>.metricCard:last-child"),
  "último KPI não recebeu correção de grid",
);

ok(
  css.includes("@media(max-width:390px)"),
  "faixa responsiva 390px ausente",
);

ok(
  (orders.match(/onSnapshot\s*\(/g) || []).length === 1,
  "listener operacional de pedidos foi alterado",
);

console.log("DFL ADMIN V34.2 — MOBILE POLISH — ZERO ERROS");
