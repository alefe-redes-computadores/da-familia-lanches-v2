import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");

const ok = (v, m) => {
  if (!v) throw new Error(`V34.3 R1: ${m}`);
};

const admin = read("src/app/admin/admin.module.css");
const catalog = read("src/components/admin/CatalogAdmin.module.css");
const delivery = read("src/components/admin/DeliveryRatesAdmin.module.css");
const page = read("src/app/admin/page.tsx");
const orders = read("src/hooks/useAdminOrders.ts");
const v27 = read("scripts/test-admin-final-experience-v27.mjs");

ok(
  admin.includes("V34.3 R1 — TWA / APP RESPONSIVE AUTHORITY"),
  "camada TWA ausente",
);

ok(
  admin.includes("min-width:112px!important"),
  "abas do app ainda podem truncar",
);

ok(
  admin.includes("text-overflow:clip!important"),
  "texto das abas ainda usa ellipsis",
);

ok(
  admin.includes("scroll-snap-type:x proximity"),
  "navegação horizontal não ganhou snap",
);

ok(
  admin.includes("grid-template-columns:42px minmax(0,1fr) auto"),
  "KPI principal não foi reorganizado",
);

ok(
  catalog.includes("V34.3 R1 — CATALOG RESPONSIVE AUTHORITY"),
  "catálogo final ausente",
);

ok(
  catalog.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),
  "métricas catálogo não estão 2x2",
);

ok(
  delivery.includes("V34.3 R1 — DELIVERY RESPONSIVE AUTHORITY"),
  "fretes finais ausentes",
);

ok(
  delivery.includes("max-height:none!important"),
  "lista de bairros ainda tem scroll interno mobile",
);

ok(
  !fs.existsSync("src/app/admin/error.tsx"),
  "diagnóstico temporário ainda existe",
);

ok(
  !v27.includes("const queueContext = useMemo"),
  "contrato V27 ainda exige hook antigo",
);

ok(
  page.includes("const queueContext = (() =>"),
  "hook-order R5 foi perdido",
);

ok(
  (orders.match(/onSnapshot\s*\(/g) || []).length === 1,
  "listener único foi alterado",
);

console.log("DFL ADMIN V34.3 R1 — TWA FINAL — ZERO ERROS");
