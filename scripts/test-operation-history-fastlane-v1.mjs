import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const ok = (condition, label) => {
  if (!condition) throw new Error(`FALHOU: ${label}`);
  console.log(`OK: ${label}`);
};

const api = read("src/app/api/admin/orders/route.ts");
const hook = read("src/hooks/useAdminOrders.ts");
const page = read("src/app/admin/page.tsx");
const admin = read("src/lib/adminOrders.ts");
const orders = read("src/app/api/orders/route.ts");
const messaging = read("src/lib/integration/server/messagingProjection.ts");
const reverse = read("src/lib/integration/server/reversePersistence.ts");

ok(api.includes('mode === "history"'), "API possui modo histórico");
ok(api.includes('const HISTORY_SNAPSHOT_LIMIT = 500') && api.includes('adminDb.collection(\"Pedidos\").limit(HISTORY_SNAPSHOT_LIMIT).get()') && api.includes('terminal.sort((a,b)=>') && api.includes('terminalMillis(a.data() as Raw)'), "histórico independe da data legado");
ok(api.includes("historyCursor"), "histórico possui cursor");
ok(api.includes('truncated:snap.size>=HISTORY_SNAPSHOT_LIMIT') && api.includes('encodeHistoryCursor(nextOffset)') && api.includes('decodeHistoryCursor(cursorValue)'), "scan histórico é limitado");

ok(
  hook.includes('where("status", "in", [...ACTIVE_QUERY_STATUSES])'),
  "fila ativa usa um listener consolidado",
);
ok(
  !hook.includes("for (const status of ACTIVE_STATUSES)"),
  "listeners por status removidos",
);
ok(hook.includes("loadMoreHistory"), "hook pagina histórico");
ok(page.includes("Carregar mais 20 pedidos") && page.includes("loadMoreHistory()"), "admin expõe paginação");

ok(
  admin.includes("Aguardando aceite há mais de 30 min"),
  "Pendente possui semântica de aceite",
);

ok(
  orders.includes('import { after, NextRequest, NextResponse } from "next/server"'),
  "Next after importado",
);
ok(
  orders.includes("after(async () =>"),
  "relay usa after-response suportado",
);
ok(
  !orders.includes("void drainIntegrationOutboxEvent(result.eventId)"),
  "fire-and-forget cru removido",
);

ok(
  messaging.includes("permanentlyUnsupportedIntent"),
  "mensageria classifica poison intent",
);
ok(
  messaging.includes("messaging_eligible:false"),
  "poison intent sai do polling",
);
ok(
  messaging.includes('status:"pending"') &&
    messaging.includes("temporariamente sem dados"),
  "falha transitória continua retry",
);

ok(
  !reverse.includes(
    'event.event_type === "delivery.assigned" ? "delivery_assigned"',
  ),
  "assigned não cria mensagem inválida",
);
ok(
  !reverse.includes(
    'event.event_type === "delivery.position_changed" ? "delivery_position_changed"',
  ),
  "position_changed não cria mensagem inválida",
);

console.log("============================================================");
console.log(" OPERAÇÃO + HISTÓRICO + FASTLANE V1 — CONTRATO OK");
console.log("============================================================");
