import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V21.3: ${m}`)};
const hook=read("src/hooks/useAdminOrders.ts");
const pwa=read("src/components/admin/AdminPwa.tsx");
const page=read("src/app/admin/page.tsx");
ok(hook.includes("alertedPendingIdsRef")&&hook.includes("acknowledgedPendingIdsRef"),"dedupe/reconhecimento ausente");
ok(!hook.includes("knownPendingIdsRef"),"bootstrap ainda engole pendentes");
ok(hook.includes("pendingOrders.map(alarmCandidate)")&&hook.includes("payload.orders"),"reload/snapshot não rearmam");
ok(hook.includes('"dfl:admin-push-foreground"'),"hook sem FCM foreground");
ok(pwa.includes("onMessage")&&pwa.includes('"dfl:admin-push-foreground"'),"PWA sem FCM foreground");
ok(
  /admin-sw\.js\?v=(?:21\.3|2[2-9]|[3-9]\d|\d{3,})/.test(pwa),
  "SW precisa permanecer versionado em V21.3 ou superior"
);
ok(hook.includes("forceVisible: !audible")&&hook.includes("navigator.vibrate?."),"fallback perdido");
ok(page.includes("reconhecerPedido(id)")&&page.includes("desfazerReconhecimentoPedido(id)"),"ação não reconhece/reativa");
ok((hook.match(/onSnapshot\(/g)||[]).length===1,"listener Firestore adicional");
console.log("ADMIN ALARM V21.3 CONTRACT: OK");
