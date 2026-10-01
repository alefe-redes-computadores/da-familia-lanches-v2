import fs from "node:fs";

const source = fs.readFileSync(
  "src/lib/integration/server/messagingProjection.ts",
  "utf8",
);

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V15.4: ${message}`);
  }
};

ok(
  source.includes('n === "finalizado"'),
  "Finalizado não possui projeção comercial",
);

ok(
  source.includes(
    'text(payload.tipoEntrega) === "pickup"',
  ),
  "Finalizado não está restrito a retirada",
);

ok(
  source.includes('return "delivery.completed";'),
  "retirada concluída não usa o template de conclusão",
);

const finalizadoIndex =
  source.indexOf('n === "finalizado"');

const pickupIndex =
  source.indexOf(
    'text(payload.tipoEntrega) === "pickup"',
    finalizadoIndex,
  );

const completedIndex =
  source.indexOf(
    'return "delivery.completed";',
    finalizadoIndex,
  );

ok(
  finalizadoIndex >= 0 &&
    pickupIndex > finalizadoIndex &&
    completedIndex > pickupIndex,
  "guarda pickup → delivery.completed inconsistente",
);

ok(
  source.includes(
    'case "delivery_completed": return "delivery.completed";',
  ),
  "conclusão vinda do DFL Entregas foi perdida",
);

console.log(
  "V15.4 conclusão pickup + autoridade delivery: OK",
);
