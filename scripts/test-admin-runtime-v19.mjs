import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => { if (!value) throw new Error(`V19: ${message}`); };

const hook = read("src/hooks/useAdminOrders.ts");
const pwa = read("src/components/admin/AdminPwa.tsx");
const sw = read("public/admin-sw.js");
const manifest = read("src/app/admin-manifest.webmanifest/route.ts");

ok(hook.includes('new Audio("/notification-default.wav")'), "alarme ainda depende de áudio remoto");
ok(hook.includes('dfl:admin-alert'), "pedido novo não publica alerta local");
ok(hook.includes('dfl:admin-badge'), "contador do aplicativo ausente");
ok(pwa.includes('Notification.requestPermission()'), "permissão explícita de notificação ausente");
ok(pwa.includes('beforeinstallprompt'), "instalação PWA não assistida");
ok(pwa.includes('navigator.onLine'), "estado offline ausente");
ok(sw.includes('showNotification'), "service worker não apresenta notificações");
ok(sw.includes('notificationclick'), "notificação não abre o Admin");
ok(manifest.includes('short_name: "DFL Admin"') && manifest.includes('shortcuts'), "identidade instalável ausente");
ok(hook.includes('nextStatus === "Pronto"'), "alerta de pedido pronto ausente");
ok((hook.match(/onSnapshot\(/g) || []).length === 1, "V19 criou listener Firestore adicional");
console.log("ADMIN RUNTIME V19 CONTRACT: OK");
