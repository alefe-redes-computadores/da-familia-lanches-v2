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

ok(
  scheduling.includes("normalizeStoreSettings") &&
  scheduling.includes("store.schedule[day]"),
  "checkout ainda lê schedule cru/legado",
);

ok(
  checkout.includes("firstAvailable") &&
  checkout.includes("scheduleGroups") &&
  checkout.includes("styles.scheduleSlots"),
  "horários não possuem seleção segura/visual",
);

ok(
  checkoutCss.includes("V21.2 — SCHEDULING EXPERIENCE") &&
  checkoutCss.includes('.scheduleSlots button[data-active="true"]'),
  "agenda visual não foi estilizada",
);

const created = checkout.indexOf(
  "const created = await createCustomerOrder",
);
const clear = checkout.indexOf(
  "clearCart();",
  created,
);
const success = checkout.indexOf(
  'openModal("order-success"',
  created,
);

ok(
  created >= 0 &&
  clear > created &&
  success > clear,
  "carrinho não limpa exclusivamente após confirmação real",
);

ok(
  checkout.includes("cartPreserved: false"),
  "tela de sucesso ainda oferece manter carrinho já enviado",
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
