import { spawnSync } from "node:child_process";
import fs from "node:fs";

const suites=[
  "scripts/test-admin-runtime-v19.mjs",
  "scripts/test-pre-apk-site-fixes-v21-2.mjs",
  "scripts/test-admin-production-polish-v22.mjs",
  "scripts/test-admin-scheduling-v23.mjs",
  "scripts/test-admin-operational-experience-v24.mjs",
  "scripts/test-admin-entregas-bridge-v25.mjs",
  "scripts/test-admin-release-v26.mjs",
  "scripts/test-admin-final-experience-v27.mjs",
  "scripts/test-admin-production-runtime-v28.mjs",
  "scripts/test-admin-new-task-v21-5-4.mjs",
  "scripts/test-admin-clean-launch-intent-v21-5-3.mjs",
  "scripts/test-admin-manage-data-v21-5-2.mjs",
];

for(const suite of suites){
  if(!fs.existsSync(suite))throw new Error(`V28 RELEASE: suíte ausente ${suite}`);
  const result=spawnSync(process.execPath,[suite],{stdio:"inherit"});
  if(result.status!==0)throw new Error(`V28 RELEASE: falhou ${suite}`);
}

console.log("V28 ADMIN RELEASE GATE — ZERO ERROS");
