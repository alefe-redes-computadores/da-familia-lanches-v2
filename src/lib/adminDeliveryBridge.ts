const ENTREGAS_PACKAGE = "com.dfl.entregas";
const ENTREGAS_SCHEME = "dflentregas";

function cleanId(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 160);
}

export function dflEntregasIntentUrl(
  deliveryId: unknown,
  adminOrderId?: unknown,
) {
  const id = cleanId(deliveryId);
  if (!id) return "";

  const order = cleanId(adminOrderId);
  const fallback =
    `https://admin.dafamilialanches.com.br/admin?stage=expedicao${
      order
        ? `&order=${encodeURIComponent(order)}`
        : ""
    }`;

  return (
    `intent://delivery?id=${encodeURIComponent(id)}` +
    `#Intent;scheme=${ENTREGAS_SCHEME};` +
    `package=${ENTREGAS_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}

export function dflEntregasLauncherIntentUrl() {
  return (
    "intent:#Intent;" +
    `package=${ENTREGAS_PACKAGE};` +
    "action=android.intent.action.MAIN;" +
    "category=android.intent.category.LAUNCHER;end"
  );
}

export function openDflEntregas(
  deliveryId: unknown,
  adminOrderId?: unknown,
) {
  if (typeof window === "undefined") return false;

  const deepLink = dflEntregasIntentUrl(
    deliveryId,
    adminOrderId,
  );
  const launcher = dflEntregasLauncherIntentUrl();

  if (!deepLink) {
    window.location.href = launcher;
    return true;
  }

  let leftAdmin = false;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      leftAdmin = true;
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.location.href = deepLink;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    if (!leftAdmin && document.visibilityState === "visible") {
      window.location.href = launcher;
    }
  }, 850);

  return true;
}
