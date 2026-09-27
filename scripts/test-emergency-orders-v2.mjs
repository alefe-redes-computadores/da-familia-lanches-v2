import fs from "node:fs";

const hook =
  fs.readFileSync("src/hooks/useAdminOrders.ts", "utf8");

const orders =
  fs.readFileSync("src/app/api/orders/route.ts", "utf8");

function ok(value, message) {
  if (!value) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

ok(
  hook.includes("adminOrdersRecoveryTick"),
  "watchdog administrativo instalado"
);

ok(
  hook.includes('window.addEventListener("focus", recover)'),
  "admin recupera ao voltar para tela"
);

ok(
  hook.includes('document.addEventListener("visibilitychange", recover)'),
  "admin recupera após suspensão"
);

ok(
  hook.includes("30000"),
  "watchdog limitado a 30 segundos"
);

ok(
  orders.includes(
    "void drainIntegrationOutboxEvent(result.eventId)"
  ),
  "checkout não espera relay externo"
);

ok(
  orders.includes("tx.create(orderRef, canonicalOrder)"),
  "persistência do pedido preservada"
);

ok(
  orders.includes("INTEGRATION_COLLECTIONS.outbox"),
  "outbox transacional preservada"
);

console.log(
  "EMERGENCY ORDERS V2 — CONTRATO OK"
);
