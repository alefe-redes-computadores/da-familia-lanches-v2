import fs from "node:fs";

const s = fs.readFileSync(
  "src/lib/integration/server/reversePersistence.ts",
  "utf8",
);

const ok = (v, m) => {
  if (!v) throw new Error("V17.4 SITE: " + m);
};

ok(
  s.includes('reason: "delivery_completed_catch_up"'),
  "Pronto pode recuperar para Finalizado quando a logística concluiu",
);

ok(
  s.includes('recoveredFromCompleted: true'),
  "histórico preserva a etapa Saiu para Entrega",
);

ok(
  s.includes("event.payload.recoveryReplay !== true"),
  "replay histórico não dispara WhatsApp atrasado",
);

ok(
  s.includes("deliveryOperationalCompleted"),
  "autoridade logística permanece registrada",
);

console.log("OK: V17.4 Site commercial catch-up");
