import fs from "node:fs";

const entry =
  fs.readFileSync(
    "android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java",
    "utf8",
  );

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V21.5.1: ${message}`);
  }
};

ok(
  !entry.includes("BuildConfig.VERSION_CODE"),
  "EntryActivity ainda referencia BuildConfig.VERSION_CODE",
);

ok(
  entry.includes("currentVersionCode") &&
  entry.includes("PackageInfo") &&
  entry.includes("getLongVersionCode"),
  "versionCode não vem do PackageManager",
);

ok(
  entry.includes(".putLong(") &&
  entry.includes(".getLong("),
  "persistência do versionCode não usa long",
);

console.log(
  "ADMIN BUILDCONFIG V21.5.1 CONTRACT: OK",
);
