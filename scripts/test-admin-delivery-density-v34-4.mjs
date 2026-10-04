import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const ok = (v, m) => {
  if (!v) throw new Error(`V34.4: ${m}`);
};

const tsx = read("src/components/admin/DeliveryRatesAdmin.tsx");
const css = read("src/components/admin/DeliveryRatesAdmin.module.css");
const orders = read("src/hooks/useAdminOrders.ts");

ok(
  tsx.includes("rateIdentity"),
  "identidade compacta do bairro ausente",
);

ok(
  tsx.includes("Taxa de entrega"),
  "subtítulo da linha ausente",
);

ok(
  tsx.includes("editCue"),
  "ação discreta de edição ausente",
);

ok(
  css.includes("V34.4 — DELIVERY DENSITY POLISH"),
  "camada V34.4 ausente",
);

ok(
  css.includes("min-height:52px!important"),
  "densidade das linhas não foi reduzida",
);

ok(
  css.includes("font-weight:900!important"),
  "preço não ganhou hierarquia forte",
);

ok(
  css.includes("max-height:none!important"),
  "lista ainda possui scroll interno mobile",
);

ok(
  (orders.match(/onSnapshot\s*\(/g) || []).length === 1,
  "listener operacional foi alterado",
);

console.log("DFL ADMIN V34.4 — DELIVERY DENSITY — ZERO ERROS");
