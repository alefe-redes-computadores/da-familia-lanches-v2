import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error("V22: "+m)};
const sw=read("public/admin-sw.js");
const pwa=read("src/components/admin/AdminPwa.tsx");
const push=read("src/lib/adminPush/server.ts");
const manifest=read("android-admin/app/src/main/AndroidManifest.xml");
const assets=read("scripts/generate-admin-android-assets.py");
const cacheVersion = Number(sw.match(/dfl-admin-v(\d+)/)?.[1] || 0);
ok(cacheVersion >= 22,"cache SW");
const badgeVersion = Number(sw.match(/admin-notification-badge\.png\?v=(\d+)/)?.[1] || 0);
ok(badgeVersion >= 22,"badge web");
ok(sw.includes('icon:"/admin-icon-192x192.png?v=54"'),"icone visual");
ok(sw.includes("hasVisibleAdminClient"),"supressao foreground");
ok(sw.includes("notificationclick")&&sw.includes("client.navigate(target)"),"deep-link");
ok(sw.includes("renotify:true")&&sw.includes("vibrate:[180,90,180]"),"alerta operacional");
const swRegisterVersion = Number(pwa.match(/register\("\/admin-sw\.js\?v=(\d+)"/)?.[1] || 0);
ok(swRegisterVersion >= 22,"registro SW");
ok(pwa.includes("permissionBlocked"),"permissao bloqueada");
ok(pwa.includes("Ative os alertas para receber novos pedidos"),"copy APK");
ok(pwa.includes("syncRemotePush")&&pwa.includes("onMessage(getMessaging(app)"),"FCM");
ok(push.includes('type:"admin.new_order"'),"protocolo push");
ok(push.includes('title:"Novo pedido recebido"'),"titulo push");
ok(
  push.includes("stage=cozinha"),
  "destino cozinha"
);
ok(push.includes('Urgency:"high"')&&push.includes('TTL:"120"'),"prioridade push");
ok(push.includes("AdminPushDispatches"),"idempotencia");
ok(manifest.includes('android.support.customtabs.trusted.SMALL_ICON'),"SMALL_ICON");
ok(manifest.includes('@drawable/ic_stat_dfl_admin'),"drawable monocromatico");
ok(manifest.includes('android.permission.POST_NOTIFICATIONS'),"permissao Android");
ok(assets.includes('ic_stat_dfl_admin.png')&&assets.includes('admin-notification-badge.png'),"assets unificados");
console.log("V22 OK — PUSH + BADGE + TWA + SETUP POLIDOS");
