import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V21.4: ${m}`)};

const manifest=
  read("android-admin/app/src/main/AndroidManifest.xml");

const safe=
  read("android-admin/app/src/main/java/br/com/dafamilialanches/admin/SafeLauncherActivity.java");

const gradle=
  read("android-admin/app/build.gradle");

const strings=
  read("android-admin/app/src/main/res/values/strings.xml");

const assetlinks=
  read("src/app/.well-known/assetlinks.json/route.ts");

ok(
  manifest.includes('android:name=".SafeLauncherActivity"') &&
  safe.includes("extends LauncherActivity"),
  "launcher não usa a base oficial Android Browser Helper",
);

ok(
  !manifest.includes(
    'android:name=".LauncherActivity"'
  ),
  "launcher customizado antigo voltou",
);

ok(
  !manifest.includes(
    'android:name=".Application"'
  ),
  "Application vazia voltou ao boot",
);

// R60: updater's FileProvider does NOT participate in the TWA cold start.
// Accept only this single, private provider. The launcher still cannot use
// the legacy splash metadata or an unrestricted file-sharing authority.
const providers = [...manifest.matchAll(/<provider\b[\s\S]*?<\/provider>/g)].map(match => match[0]);
const updatePaths = read('android-admin/app/src/main/res/xml/dfl_update_paths.xml');
ok(
  !manifest.includes("SPLASH_IMAGE_DRAWABLE") &&
  !manifest.includes("FILE_PROVIDER_AUTHORITY") &&
  providers.length === 1 &&
  providers[0].includes('android:name="androidx.core.content.FileProvider"') &&
  providers[0].includes('android:authorities="${applicationId}.updates.fileprovider"') &&
  providers[0].includes('android:exported="false"') &&
  providers[0].includes('android:grantUriPermissions="true"') &&
  providers[0].includes('android:resource="@xml/dfl_update_paths"') &&
  updatePaths.includes('name="dfl-apk-updates" path="dfl-apk-updates/"') &&
  !updatePaths.includes('path="."') &&
  !updatePaths.includes('root-path'),
  "cold start ou FileProvider exclusivo do atualizador divergiu",
);

ok(
  !manifest.includes(
    'android:launchMode="singleTask"'
  ),
  "singleTask incompatível voltou ao LauncherActivity",
);

ok(
  manifest.includes(
    "TRUSTED_WEB_ACTIVITY_SERVICE"
  ) &&
  manifest.includes(
    'android:name=".DelegationService"'
  ),
  "delegação de notificações foi perdida",
);

ok(
  manifest.includes(
    'android:autoVerify="true"'
  ) &&
  manifest.includes(
    'android:host="admin.dafamilialanches.com.br"'
  ),
  "deep link verificado foi perdido",
);

ok(
  strings.includes(
    "https://admin.dafamilialanches.com.br/"
  ),
  "launch URL oficial divergiu",
);

ok(
  gradle.includes(
    'applicationId "br.com.dafamilialanches.admin"'
  ) &&
  gradle.includes(
    "androidbrowserhelper:2.7.3"
  ),
  "identidade/runtime Android divergiu",
);

ok(
  assetlinks.includes(
    "br.com.dafamilialanches.admin"
  ) &&
  assetlinks.includes(
    "77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63"
  ),
  "DAL/assinatura foram alterados",
);

console.log(
  "ADMIN SAFE LAUNCHER V21.4 CONTRACT: OK"
);
