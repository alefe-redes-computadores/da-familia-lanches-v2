import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V29 ADMIN: ${m}`);};

const entry=read("android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java");
const manifest=read("android-admin/app/src/main/AndroidManifest.xml");
const pwa=read("src/components/admin/AdminPwa.tsx");
const bridge=read("src/lib/adminDeliveryBridge.ts");
const card=read("src/components/layout/OrderCard.tsx");
const hook=read("src/hooks/useAdminOrders.ts");
const workflow=read(".github/workflows/build-admin-android.yml");

ok(manifest.includes("android.permission.POST_NOTIFICATIONS"),"POST_NOTIFICATIONS ausente");
ok(manifest.includes("TRUSTED_WEB_ACTIVITY_SERVICE"),"DelegationService ausente");
ok(manifest.includes("NotificationPermissionRequestActivity"),"bridge de permissão ABH ausente");
ok(entry.includes("REQUEST_NATIVE_NOTIFICATIONS"),"request code nativo ausente");
ok(entry.includes("android.Manifest.permission.POST_NOTIFICATIONS"),"permissão nativa não solicitada");
ok(entry.includes("launchTwaWithNativeNotificationPermission"),"TWA abre sem gate nativo");
ok(entry.includes("onRequestPermissionsResult"),"retorno da permissão nativa ausente");
ok(pwa.includes("V29: a abertura da TWA sempre revalida"),"token não revalidado ao abrir");
ok(pwa.includes("syncRemotePush(registration)"),"sync remoto perdido");
ok(bridge.includes("dflEntregasLauncherIntentUrl"),"fallback launcher ausente");
ok(bridge.includes("android.intent.action.MAIN"),"fallback não abre pacote principal");
ok(bridge.includes("visibilitychange"),"ponte não detecta saída do Admin");
ok(card.includes("handleOpenDflEntregas"),"OrderCard não usa ponte V29");
ok((hook.match(/onSnapshot\s*\(/g)||[]).length===1,"listener único alterado");
ok(workflow.includes("test-admin-native-push-bridge-v29.mjs"),"workflow não valida V29");
console.log("DFL ADMIN V29 — NATIVE PUSH + BRIDGE — ZERO ERROS");
