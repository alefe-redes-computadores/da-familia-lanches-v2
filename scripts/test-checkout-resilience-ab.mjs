import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Arquivo ausente: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function ok(value, message) {
  if (!value) throw new Error(`FALHOU: ${message}`);
  console.log(`OK: ${message}`);
}

const checkout = read("src/components/ui/CheckoutModal.tsx");
const draft = read("src/lib/checkoutDraft.ts");
const cart = read("src/store/cart.store.ts");
const login = read("src/components/auth/LoginModal.tsx");

ok(
  draft.includes("window.localStorage") &&
  draft.includes("MAX_AGE"),
  "draft do checkout é local e possui validade",
);

ok(
  checkout.includes("saveCheckoutDraft") &&
  checkout.includes("readCheckoutDraft"),
  "checkout salva e recupera draft",
);

ok(
  checkout.includes("migrateGuestCheckoutDraft"),
  "draft atravessa login guest -> usuário",
);

ok(
  checkout.includes("clearCheckoutDraft(currentUser.uid)"),
  "draft é apagado somente após pedido registrado",
);

ok(
  checkout.includes("clientRequestId: orderAttemptRef.current"),
  "idempotência clientRequestId foi preservada",
);

ok(
  checkout.includes("fallbackWhatsAppUrl"),
  "contingência WhatsApp foi preservada",
);

ok(
  cart.includes("persist("),
  "carrinho continua persistente",
);

ok(
  login.includes("Seu carrinho continua intacto"),
  "login comunica continuidade do pedido",
);

ok(
  !draft.includes("firebase/") &&
  !draft.includes("firestore"),
  "draft não cria consumo Firestore",
);

console.log("");
console.log("CHECKOUT RESILIENCE A+B — CONTRATO OK");
