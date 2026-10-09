import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V21.2: ${message}`);
};

const scheduling = read("src/lib/orderScheduling.ts");
const checkout = read("src/components/ui/CheckoutModal.tsx");
const checkoutCss = read("src/components/ui/CheckoutModal.module.css");
const last = read("src/hooks/useLastCustomerOrder.ts");
const adminOrders = read("src/hooks/useAdminOrders.ts");
const adminPwa = read("src/components/admin/AdminPwa.tsx");
const sw = read("public/admin-sw.js");
const repository = read("src/lib/orderRepository.ts");
const reverse = read("src/lib/integration/server/reversePersistence.ts");

const schedulingUsesLegacyNormalizedEngine =
  scheduling.includes("normalizeStoreSettings") &&
  scheduling.includes("store.schedule[day]");

const schedulingUsesAuthoritativeApi =
  scheduling.includes('fetch("/api/orders/schedule-slots"') &&
  scheduling.includes('cache: "no-store"') &&
  fs.existsSync("src/lib/orderSchedulePolicy.ts") &&
  fs.existsSync("src/app/api/orders/schedule-slots/route.ts");

ok(
  schedulingUsesLegacyNormalizedEngine ||
  schedulingUsesAuthoritativeApi,
  "checkout ainda lê schedule cru/legado",
);

ok(
  checkout.includes("setScheduledFor((current) =>") && checkout.includes("!slot.disabled") &&
  checkout.includes("scheduleGroups") &&
  checkout.includes("styles.scheduleSlots"),
  "horários não possuem seleção segura/visual",
);

ok(
  checkoutCss.includes("V21.2 — SCHEDULING EXPERIENCE") &&
  checkoutCss.includes('.scheduleSlots button[data-active="true"]'),
  "agenda visual não foi estilizada",
);

// V63.1: checkout protege o carrinho contra alterações concorrentes.
// A confirmação precisa existir antes de limpar; erros preservam os itens.
const guardStart = checkout.indexOf("const clearConfirmedCart = () =>");
const guardEnd = checkout.indexOf("submittingRef.current=true", guardStart);
const guard = guardStart >= 0 && guardEnd > guardStart
  ? checkout.slice(guardStart, guardEnd)
  : "";

ok(
  guard.includes("useCartStore.getState().items") &&
  guard.includes("submittedCart !== currentCart") &&
  guard.includes("return false") &&
  guard.indexOf("submittedCart !== currentCart") <
    guard.indexOf("clearCart();") &&
  guard.includes("clearCart();") &&
  guard.includes("return true"),
  "limpeza do carrinho perdeu a proteção contra alterações",
);

const createCalls = [...checkout.matchAll(/(?:const created\s*=\s*await createCustomerOrder\s*\()/g)]
  .map(match => match.index);

const clearCalls = [...checkout.matchAll(/const cartCleared\s*=\s*clearConfirmedCart\s*\(\s*\)/g)]
  .map(match => match.index);

const successCalls = [...checkout.matchAll(/openModal\s*\(\s*["']order-success["']/g)]
  .map(match => match.index);

ok(
  createCalls.length === 2 &&
  clearCalls.length === 2 &&
  successCalls.length === 2 &&
  createCalls.every((position, index) =>
    position < clearCalls[index] &&
    clearCalls[index] < successCalls[index]
  ),
  "convidado e cliente Google devem limpar somente após pedido criado",
);

ok(
  (checkout.match(/cartPreserved:\s*!cartCleared/g) || []).length === 2,
  "sucesso deve informar se o carrinho foi realmente preservado",
);

ok(
  last.includes('"Loyalty",') &&
  last.includes("lastCompletedOrderId") &&
  last.includes("lastOrderId"),
  "último pedido ignora projeção autoritativa",
);

ok(
  last.includes('===\n      "Finalizado"') ||
  last.includes('=== "Finalizado"'),
  "último pedido não valida Finalizado",
);

ok(
  repository.includes("lastCompletedOrderId:input.orderId") &&
  reverse.includes("lastCompletedOrderId:event.payload.externalOrderId"),
  "projeção futura do último concluído incompleta",
);

ok(
  adminOrders.includes("forceVisible: !audible") &&
  adminOrders.includes("navigator.vibrate?.") &&
  adminOrders.includes("await target.play()"),
  "alarme não possui fallback quando autoplay é bloqueado",
);

ok(
  adminPwa.includes("forceVisible?:boolean") &&
  sw.includes("!data.forceVisible"),
  "fallback do alarme não alcança o Service Worker",
);

ok(
  (adminOrders.match(/onSnapshot\(/g) || []).length === 1,
  "V21.2 criou listener Admin adicional",
);

console.log("PRE-APK SITE FIXES V21.2 CONTRACT: OK");
