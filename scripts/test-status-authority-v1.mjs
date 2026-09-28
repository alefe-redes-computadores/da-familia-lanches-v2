import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const ok = (v, label) => {
  if (!v) throw new Error(`FALHOU: ${label}`);
  console.log(`OK: ${label}`);
};

const reverse = read("src/lib/integration/server/reversePersistence.ts");
const repo = read("src/lib/orderRepository.ts");
const admin = read("src/app/admin/page.tsx");

ok(
  reverse.includes('if (type === "delivery.out_for_delivery") return "Saiu para Entrega";'),
  "out_for_delivery pode projetar saída comercial",
);

ok(
  !reverse.includes('["delivery.out_for_delivery","delivery.position_changed","delivery.next_stop","route.started"]'),
  "posição/next_stop/route.started não avançam status comercial",
);

ok(
  repo.indexOf("if (current === next)") <
    repo.indexOf("ORDER_STATUS_CONFLICT:"),
  "idempotência acontece antes do conflito",
);

ok(
  repo.includes("ORDER_STATUS_CONFLICT:"),
  "conflito devolve status real",
);

ok(
  admin.includes('message.startsWith("ORDER_STATUS_CONFLICT:")'),
  "admin entende conflito estruturado",
);

ok(
  admin.includes("A fila foi atualizada"),
  "admin não acusa falso erro genérico",
);

console.log("============================================================");
console.log(" STATUS AUTHORITY V1 — CONTRATO OK");
console.log("============================================================");
