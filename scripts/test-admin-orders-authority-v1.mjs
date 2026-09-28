import fs from "node:fs";

const hook =
  fs.readFileSync("src/hooks/useAdminOrders.ts", "utf8");

const route =
  fs.readFileSync("src/app/api/admin/orders/route.ts", "utf8");

const authz =
  fs.readFileSync("src/lib/adminAuthorization.ts", "utf8");

function ok(value, message) {
  if (!value) {
    console.error("FAIL:", message);
    process.exit(1);
  }

  console.log("OK:", message);
}

ok(
  route.includes('adminDb') &&
  route.includes('.collection("Pedidos")'),
  "endpoint usa Firebase Admin"
);

ok(
  route.includes("adminAuth.verifyIdToken"),
  "endpoint valida ID token"
);

ok(
  route.includes("isAdminEmail(decoded.email)"),
  "endpoint exige administrador"
);

ok(
  route.includes('.orderBy("data", "desc")') &&
  route.includes(".limit(40)"),
  "endpoint lê janela operacional"
);

ok(
  hook.includes('fetch("/api/admin/orders"'),
  "Admin possui bootstrap autoritativo"
);

ok(
  hook.includes("onSnapshot(ordersQuery"),
  "realtime client foi preservado"
);

ok(
  !hook.includes("adminOrdersRecoveryTick") &&
  !hook.includes("setInterval(recover, 30000)"),
  "watchdog agressivo removido"
);

ok(
  authz.includes("alefejohsefe@gmail.com"),
  "whitelist administrativa preservada"
);

console.log(
  "ADMIN ORDERS AUTHORITY V1 — CONTRATO OK"
);
