const fs = require("fs");

const siteTargets = [
  "src/hooks/useCatalog.ts",
  "src/hooks/useCatalogCategories.ts",
  "src/lib/publicCatalogClient.ts",
];

let failed = 0;

for (const file of siteTargets) {
  const source = fs.readFileSync(file, "utf8");
  const directFirestore = /\b(onSnapshot|getDocs|getDoc|collectionGroup)\s*\(/.test(source);
  console.log(`${directFirestore ? "ERRO" : "OK"}: ${file} sem leitura Firestore direta`);
  if (directFirestore) failed += 1;
}

const route = fs.readFileSync("src/app/api/public/catalog/route.ts", "utf8");
const collectionScans = (route.match(/\.collection\([^)]+\)\.get\(\)/g) || []).length;
console.log(`INFO: scans de coleção no catálogo = ${collectionScans} (permitidos apenas dentro do rebuild materializado)`);

if (!route.includes("return rebuildCatalogSnapshot();")) {
  console.log("ERRO: rebuild materializado não está isolado");
  failed += 1;
}

if (failed) process.exit(1);
console.log("FIRESTORE BUDGET V1: auditoria de hot path OK");
