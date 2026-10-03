import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V21.5: ${m}`)};

const manifest=
  read("android-admin/app/src/main/AndroidManifest.xml");

const entry=
  read("android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java");

const safe=
  read("android-admin/app/src/main/java/br/com/dafamilialanches/admin/SafeLauncherActivity.java");

const workflow=
  read(".github/workflows/build-admin-android.yml");

const assetlinks=
  read("src/app/.well-known/assetlinks.json/route.ts");

ok(
  manifest.includes(
    'android:name=".EntryActivity"'
  ) &&
  manifest.includes(
    'android:name=".SafeLauncherActivity"'
  ),
  "entry/launcher resiliente ausentes",
);

ok(
  !manifest.includes(
    'android:launchMode="singleTask"'
  ),
  "singleTask ainda está no boot TWA",
);

ok(
  manifest.includes(
    "android.support.customtabs.trusted.LAUNCHING_BROWSER"
  ) &&
  manifest.includes(
    'android:value="com.android.chrome"'
  ),
  "Chrome não foi fixado como provider TWA",
);

ok(
  safe.includes(
    "extends LauncherActivity"
  ) &&
  safe.includes(
    "getFallbackStrategy()"
  ),
  "SafeLauncher não deriva do runtime oficial/fallback",
);

ok(
  safe.includes(
    "setDefaultUncaughtExceptionHandler"
  ) &&
  safe.includes(
    "recordCrash"
  ),
  "crash journal nativo ausente",
);

ok(
  entry.includes(
    "Copiar diagnóstico"
  ) &&
  entry.includes(
    "Tentar abrir novamente"
  ) &&
  entry.includes(
    "Abrir Admin no navegador"
  ),
  "tela de diagnóstico não tem ações de recuperação",
);

ok(
  entry.includes(
    "currentVersionCode"
  ) &&
  entry.includes(
    "getLongVersionCode"
  ) &&
  entry.includes(
    "PackageInfo"
  ) &&
  !entry.includes(
    "BuildConfig.VERSION_CODE"
  ),
  "versionamento do diagnóstico depende de BuildConfig ou não usa PackageManager",
);

ok(
  entry.includes(
    "com.android.chrome"
  ) &&
  entry.includes(
    "com.sec.android.app.sbrowser"
  ),
  "fallback de navegador seguro insuficiente",
);

ok(
  manifest.includes(
    "TRUSTED_WEB_ACTIVITY_SERVICE"
  ),
  "delegação de push foi perdida",
);

ok(
  assetlinks.includes(
    "77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63"
  ),
  "assinatura/DAL divergiu",
);

ok(
  workflow.includes(
    "test-admin-resilient-launcher-v21-5.mjs"
  ),
  "CI não valida V21.5",
);

console.log(
  "ADMIN RESILIENT LAUNCHER V21.5 CONTRACT: OK"
);
