import fs from "node:fs";

const s = fs.readFileSync(
  "src/lib/smartCart.ts",
  "utf8",
);

const checks = [
  [
    s.includes("upsellProductId") &&
      s.includes("upsellUnitPrice"),
    "upsell explícito preservado",
  ],
  [
    s.includes(
      "resolveBundleItems",
    ),
    "composição de combo preservada",
  ],
  [
    s.includes("matchingCombo"),
    "comparação econômica preservada",
  ],
  [
    s.includes("hasDrink"),
    "bebida de combo é detectada",
  ],
  [
    s.includes(
      "!included.has(product.id)",
    ),
    "produto interno de combo excluído globalmente",
  ],
  [
    s.includes("getDailySeed"),
    "rotação diária presente",
  ],
  [
    s.includes("rotationKey"),
    "carrinho participa do desempate",
  ],
  [
    s.includes(
      "const complements = available",
    ),
    "pool de complementos presente",
  ],
  [
    s.includes(
      "const extra of complements",
    ),
    "várias vagas podem ser preenchidas",
  ],
  [
    !s.includes("getDoc(") &&
      !s.includes("getDocs(") &&
      !s.includes("onSnapshot("),
    "zero Firestore I/O",
  ],
];

let failed = false;

for (const [ok, label] of checks) {
  console.log(
    `${ok ? "✓" : "✗"} ${label}`,
  );

  if (!ok) failed = true;
}

if (failed) process.exit(1);

console.log(
  "\nSMART CART V2 — CONTRATO OK",
);
