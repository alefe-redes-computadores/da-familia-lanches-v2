import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V21.4: ${message}`);
  }
};

const manifest =
  read("android-admin/app/src/main/AndroidManifest.xml");

const gradle =
  read("android-admin/app/build.gradle");

const strings =
  read("android-admin/app/src/main/res/values/strings.xml");

const assetlinks =
  read("src/app/.well-known/assetlinks.json/route.ts");

ok(
  manifest.includes(
    'android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"',
  ),
  "launcher oficial não é a Activity principal",
);

ok(
  !manifest.includes(
    'android:name=".LauncherActivity"',
  ),
  "launcher customizado ainda participa do boot",
);

ok(
  !manifest.includes(
    'android:name=".Application"',
  ),
  "Application vazia ainda participa do boot",
);

ok(
  !manifest.includes(
    "SPLASH_IMAGE_DRAWABLE",
  ) &&
  !manifest.includes(
    "FILE_PROVIDER_AUTHORITY",
  ) &&
  !manifest.includes(
    "androidx.core.content.FileProvider",
  ),
  "cold start ainda depende de splash/FileProvider",
);

ok(
  manifest.includes(
    'android:value="customtabs"',
  ),
  "fallback Custom Tabs ausente",
);

ok(
  manifest.includes(
    "TRUSTED_WEB_ACTIVITY_SERVICE",
  ) &&
  manifest.includes(
    'android:name=".DelegationService"',
  ) &&
  manifest.includes(
    "@drawable/ic_stat_dfl_admin",
  ),
  "delegação de notificações foi perdida",
);

ok(
  manifest.includes(
    'android:autoVerify="true"',
  ) &&
  manifest.includes(
    'android:host="admin.dafamilialanches.com.br"',
  ),
  "deep link verificado foi perdido",
);

ok(
  strings.includes(
    "https://admin.dafamilialanches.com.br/",
  ),
  "launch URL oficial divergiu",
);

ok(
  gradle.includes(
    'applicationId "br.com.dafamilialanches.admin"',
  ) &&
  gradle.includes(
    "androidbrowserhelper:2.7.3",
  ),
  "identidade/runtime Android divergiu",
);

ok(
  assetlinks.includes(
    "br.com.dafamilialanches.admin",
  ) &&
  assetlinks.includes(
    "77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63",
  ),
  "Digital Asset Links/assinatura foram alterados",
);

console.log(
  "ADMIN SAFE LAUNCHER V21.4 CONTRACT: OK",
);
