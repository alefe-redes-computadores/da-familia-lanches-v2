import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V21: ${message}`);
};

const manifest = read("android-admin/app/src/main/AndroidManifest.xml");
const gradle = read("android-admin/app/build.gradle");
const rootGradle = read("android-admin/build.gradle");
const strings = read("android-admin/app/src/main/res/values/strings.xml");
const assetlinks = read("src/app/.well-known/assetlinks.json/route.ts");
const generator = read("scripts/generate-admin-android-assets.py");
const workflow = read(".github/workflows/build-admin-android.yml");
const hook = read("src/hooks/useAdminOrders.ts");

ok(
  gradle.includes('applicationId "br.com.dafamilialanches.admin"') &&
    gradle.includes('namespace "br.com.dafamilialanches.admin"'),
  "package Android exclusivo ausente",
);

ok(
  strings.includes("https://admin.dafamilialanches.com.br/"),
  "APK não abre o domínio oficial do Admin",
);

ok(
  gradle.includes("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3"),
  "runtime TWA oficial ausente",
);

ok(
  rootGradle.includes('com.android.application" version "8.9.1"'),
  "Android Gradle Plugin não fixado",
);

ok(
  manifest.includes("TRUSTED_WEB_ACTIVITY_SERVICE") &&
    manifest.includes("@drawable/ic_stat_dfl_admin"),
  "delegação de Web Push para notificação Android ausente",
);

ok(
  manifest.includes('android:autoVerify="true"') &&
    manifest.includes('android:host="admin.dafamilialanches.com.br"'),
  "deep link verificado do Admin ausente",
);

ok(
  assetlinks.includes("br.com.dafamilialanches.admin") &&
    assetlinks.includes("77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63"),
  "Digital Asset Links diverge da assinatura estável",
);

ok(
  generator.includes("dfl-admin-icon-master.png") &&
    generator.includes("ic_launcher_foreground.png") &&
    generator.includes("ic_stat_dfl_admin.png") &&
    generator.includes("MaxFilter"),
  "assets Android não derivam do Master",
);

ok(
  workflow.includes("DFL_ADMIN_KEYSTORE_BASE64") &&
    workflow.includes("assembleRelease") &&
    workflow.includes("apksigner") &&
    workflow.includes("actions/upload-artifact@v4"),
  "workflow não fecha assinatura/build/artefato",
);

ok(
  !workflow.includes("npm run build"),
  "workflow Android não deve buildar Next/Termux",
);

ok(
  (hook.match(/onSnapshot\(/g) || []).length === 1,
  "V21 criou listener Firestore adicional",
);

console.log("ADMIN ANDROID V21 CONTRACT: OK");
