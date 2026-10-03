import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V21.5.2: ${message}`);
  }
};

const manifest =
  read(
    "android-admin/app/src/main/AndroidManifest.xml",
  );

const strings =
  read(
    "android-admin/app/src/main/res/values/strings.xml",
  );

ok(
  manifest.includes(
    'android:manageSpaceActivity="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"',
  ),
  "application não aponta para ManageDataLauncherActivity",
);

ok(
  manifest.includes(
    'android:name="com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity"',
  ),
  "ManageDataLauncherActivity não foi declarada",
);

ok(
  manifest.includes(
    'android:name="android.support.customtabs.trusted.MANAGE_SPACE_URL"',
  ),
  "MANAGE_SPACE_URL ausente",
);

ok(
  manifest.includes(
    'android:value="@string/launch_url"',
  ),
  "ManageData não usa launch_url canônica",
);

ok(
  strings.includes(
    "https://admin.dafamilialanches.com.br/",
  ),
  "launch_url não aponta para Admin oficial",
);

ok(
  (
    manifest.match(
      /com\.google\.androidbrowserhelper\.trusted\.ManageDataLauncherActivity/g,
    ) ?? []
  ).length === 2,
  "ManageDataLauncherActivity ausente ou duplicada de forma inesperada",
);

ok(
  manifest.includes(
    'android:name=".EntryActivity"',
  ) &&
  manifest.includes(
    'android:name=".SafeLauncherActivity"',
  ),
  "Entry/SafeLauncher foram alterados",
);

ok(
  manifest.includes(
    "TRUSTED_WEB_ACTIVITY_SERVICE",
  ),
  "DelegationService/push foi perdido",
);

ok(
  manifest.includes(
    'android:value="com.android.chrome"',
  ),
  "provider Chrome V21.5 foi perdido",
);

ok(
  !manifest.includes(
    'android:launchMode="singleTask"',
  ),
  "singleTask voltou ao fluxo TWA",
);

console.log(
  "ADMIN MANAGE DATA V21.5.2 CONTRACT: OK",
);
