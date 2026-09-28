import fs from "node:fs";

const hook =
  fs.readFileSync("src/hooks/useAdminOrders.ts", "utf8");

function ok(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

ok(
  hook.includes("authoritativeOrdersRef"),
  "autoridade server-side mantida em memória"
);

ok(
  hook.includes('fetch("/api/admin/orders"'),
  "bootstrap server-side preservado"
);

ok(
  hook.includes("onSnapshot(ordersQuery"),
  "realtime preservado"
);

ok(
  hook.includes(
    "const mergedById = new Map(authoritativeOrdersRef.current)"
  ),
  "snapshot parte da autoridade existente"
);

ok(
  hook.includes(
    "mergedById.set(String(order.id), order)"
  ),
  "realtime faz upsert por ID"
);

ok(
  hook.includes("serverCount: docs.length"),
  "serverCount instrumentado"
);

ok(
  hook.includes("realtimeCount: realtimeDocs.length"),
  "realtimeCount instrumentado"
);

ok(
  hook.includes("mergedCount: docs.length"),
  "mergedCount instrumentado"
);

ok(
  !hook.includes("adminOrdersRecoveryTick"),
  "watchdog antigo ausente"
);

ok(
  !hook.includes("setInterval(recover, 30000)"),
  "polling agressivo ausente"
);

console.log(
  "ADMIN ORDERS MERGE V2 — CONTRATO OK"
);
