import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const ok = (v, label) => {
  if (!v) throw new Error(`FALHOU: ${label}`);
  console.log(`OK: ${label}`);
};

const compat = read("src/lib/orderCompat.ts");
const last = read("src/components/home/LastOrderCard.tsx");
const smart = read("src/lib/smartCart.ts");
const admin = read("src/app/admin/page.tsx");
const health = read("src/components/admin/OperationHealthAdmin.tsx");
const reverse = read("src/lib/integration/server/reversePersistence.ts");

ok(compat.includes("Array.isArray(rawOrder.items)"),
  "pedido legado/current items compatível");
ok(compat.includes("raw.productId") && compat.includes("raw.produtoId"),
  "IDs históricos reconciliados");

ok(
  last.indexOf("product?.image") < last.indexOf("item?.image"),
  "imagem atual do catálogo tem prioridade"
);
ok(last.includes('haptic("restore")'),
  "repetir pedido possui feedback tátil");
ok(last.includes("deliverySnapshot"),
  "endereço usa snapshot estruturado");
ok(last.includes("O cardápio mudou desde esse pedido"),
  "repetição parcial exige revisão");

ok(smart.includes("getRotationSeed"),
  "smart cart possui rotação contextual");
ok(smart.includes("commercialFamily"),
  "smart cart diversifica famílias");
ok(smart.includes("upsellUnitPrice"),
  "upsell continua explícito");

ok(
  health.includes("A fila usa dados já carregados") &&
  !health.includes("setInterval("),
  "saúde operacional reaproveita estado local sem polling"
);
ok(admin.includes("<OperationHealthAdmin"),
  "saúde operacional integrada ao admin");

ok(
  reverse.includes('if (type === "delivery.out_for_delivery") return "Saiu para Entrega";'),
  "Status Authority preservada"
);

console.log("============================================================");
console.log(" SUPER CIRURGIA COMERCIAL + UX — CONTRATO OK");
console.log("============================================================");
