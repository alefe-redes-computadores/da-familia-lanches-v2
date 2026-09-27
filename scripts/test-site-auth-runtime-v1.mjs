import fs from "node:fs";
import assert from "node:assert/strict";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const admin = fs.readFileSync(
  "src/lib/integration/server/admin.ts",
  "utf8",
);

const auth = fs.readFileSync(
  "src/lib/integration/server/adminAuth.ts",
  "utf8",
);

const orders = fs.readFileSync(
  "src/app/api/orders/route.ts",
  "utf8",
);

const summary = fs.readFileSync(
  "src/app/api/customer/order-summary/route.ts",
  "utf8",
);

assert.equal(
  pkg.overrides?.["jwks-rsa"]?.jose,
  "4.15.9",
  "override jwks-rsa -> jose ausente",
);

assert(
  !admin.includes("firebase-admin/auth"),
  "admin.ts nao pode carregar Auth",
);

assert(
  auth.includes('from "firebase-admin/auth"'),
  "adminAuth precisa ser a autoridade isolada de Auth",
);

for (const [name, source] of [
  ["orders", orders],
  ["order-summary", summary],
]) {
  assert(
    source.includes('integration/server/adminAuth'),
    `${name} nao usa adminAuth`,
  );

  assert(
    !source.includes('from "firebase-admin/auth"'),
    `${name} ainda importa firebase-admin/auth diretamente`,
  );

  assert(
    source.includes("adminAuth.verifyIdToken("),
    `${name} perdeu verificacao do token`,
  );
}

console.log("SITE AUTH RUNTIME V1 — CONTRATO OK");
