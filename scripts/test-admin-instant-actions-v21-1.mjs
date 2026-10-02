import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V21.1: ${message}`);
  }
};

const page =
  read("src/app/admin/page.tsx");

const repo =
  read("src/lib/orderRepository.ts");

const hook =
  read("src/hooks/useAdminOrders.ts");

ok(
  page.includes(
    "actionLocksRef",
  ) &&
  page.includes(
    "locks.has(id)",
  ) &&
  page.includes(
    "locks.add(id)",
  ) &&
  page.includes(
    "locks.delete(id)",
  ),
  "lock síncrono por pedido ausente",
);

ok(
  page.includes(
    'previousLabel === "Pendente"',
  ) &&
  page.includes(
    "pararAlarme();",
  ),
  "aceite não silencia alarme",
);

ok(
  page.includes(
    "typeof pedido?.status === \"string\"",
  ),
  "pedido.status não possui narrow TypeScript",
);

ok(
  page.includes(
    "optimisticStatuses",
  ) &&
  page.includes(
    "operationalPedidos",
  ) &&
  page.includes(
    "[id]: nextLabel",
  ),
  "resposta otimista ausente",
);

ok(
  page.includes(
    "delete next[id]",
  ),
  "rollback/limpeza otimista ausente",
);

ok(
  repo.includes(
    "async function relayOrderStatusEvent",
  ) &&
  repo.includes(
    "void relayOrderStatusEvent(",
  ),
  "relay não foi desacoplado",
);

ok(
  repo.includes(
    "keepalive: true",
  ),
  "relay background sem keepalive",
);

const updateStart =
  repo.indexOf(
    "export async function updateOrderStatus",
  );

const updateEnd =
  repo.indexOf(
    "export async function rescheduleCustomerOrder",
  );

const updateBlock =
  repo.slice(
    updateStart,
    updateEnd,
  );

ok(
  !updateBlock.includes(
    'await fetch("/api/admin/orders/relay"',
  ),
  "ação ainda espera relay HTTP",
);

ok(
  updateBlock.includes(
    "runTransaction",
  ),
  "transação idempotente removida",
);

ok(
  (hook.match(/onSnapshot\(/g) || [])
    .length === 1,
  "listener Firestore adicional criado",
);

console.log(
  "ADMIN INSTANT ACTIONS V21.1 CONTRACT: OK",
);
