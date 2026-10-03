import fs from "node:fs";

const s = fs.readFileSync(
  "android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java",
  "utf8"
);

const ok = (v, m) => {
  if (!v) throw new Error("V21.5.4: " + m);
};

ok(
  /new Intent\s*\(\s*this\s*,\s*SafeLauncherActivity\.class\s*\)/s.test(s),
  "SafeLauncherActivity precisa continuar recebendo Intent interno"
);

ok(
  /target\.addFlags\s*\(\s*Intent\.FLAG_ACTIVITY_NEW_TASK\s*\)/s.test(s),
  "FLAG_ACTIVITY_NEW_TASK obrigatório para LauncherActivity"
);

ok(
  !/new Intent\s*\(\s*getIntent\s*\(\s*\)\s*\)/s.test(s),
  "Intent público não pode voltar a ser clonado"
);

ok(
  !/target\.addCategory\s*\(\s*Intent\.CATEGORY_LAUNCHER/s.test(s),
  "CATEGORY_LAUNCHER não pode ser propagada"
);

ok(
  !/target\.setAction\s*\(\s*Intent\.ACTION_MAIN/s.test(s),
  "ACTION_MAIN não pode ser propagada"
);

ok(
  s.includes('"admin.dafamilialanches.com.br"'),
  "deep-link oficial precisa permanecer"
);

console.log(
  "V21.5.4 OK — NEW_TASK oficial + Intent interno limpo"
);
