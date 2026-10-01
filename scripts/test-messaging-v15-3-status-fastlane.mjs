import fs from "node:fs";

const repo = fs.readFileSync(
  "src/lib/orderRepository.ts",
  "utf8",
);

const route = fs.readFileSync(
  "src/app/api/admin/orders/relay/route.ts",
  "utf8",
);

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V15.3: ${message}`);
  }
};

ok(
  repo.includes("eventId: event.event_id"),
  "status não devolve eventId exato",
);

ok(
  repo.includes('fetch("/api/admin/orders/relay"'),
  "status não dispara relay direcionado",
);

ok(
  repo.includes("authorization: `Bearer ${token}`"),
  "relay admin sem bearer Firebase",
);

ok(
  repo.includes("fallback preservado"),
  "fallback operacional não documentado",
);

ok(
  route.includes("isAdminEmail(decoded.email)"),
  "endpoint não restringe admin",
);

ok(
  route.includes("after(async () =>"),
  "relay direcionado não usa after",
);

ok(
  route.includes("drainIntegrationOutboxEvent(eventId)"),
  "endpoint não drena evento exato",
);

ok(
  !route.includes("drainIntegrationOutbox()"),
  "endpoint não pode drenar lote global",
);

console.log(
  "V15.3 status → relay direcionado: OK",
);
