import{spawnSync}from"node:child_process";
const tests=[
 "scripts/test-catalog-image-performance-v40.mjs",
 "scripts/test-catalog-authority-upload-v40-1.mjs",
 "scripts/test-catalog-macrosurgery-v41.mjs",
 "scripts/test-catalog-backend-authority-v42.mjs",
 "scripts/test-catalog-finalization-v43.mjs"
];
for(const t of tests){
 const r=spawnSync(process.execPath,[t],{stdio:"inherit"});
 if(r.status!==0)process.exit(r.status??1);
}
console.log("CATALOG V43 RELEASE GATE — ZERO ERROS");
