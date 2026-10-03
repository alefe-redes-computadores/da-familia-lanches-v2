import fs from "node:fs";

const s = fs.readFileSync(
  "android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java",
  "utf8"
);

const ok = (v, m) => {
  if (!v) throw new Error("V21.5.3: " + m);
};

ok(
  /new Intent\s*\(\s*this\s*,\s*SafeLauncherActivity\.class\s*\)/s.test(s),
  "Intent interno limpo ausente"
);

ok(
  !/new Intent\s*\(\s*getIntent\s*\(\s*\)\s*\)/s.test(s),
  "Intent público ainda está sendo clonado"
);

ok(
  s.includes('"https".equalsIgnoreCase'),
  "proteção HTTPS ausente"
);

ok(
  s.includes('"admin.dafamilialanches.com.br"'),
  "host oficial ausente"
);

console.log("V21.5.3 OK — CLEAN LAUNCH INTENT");
