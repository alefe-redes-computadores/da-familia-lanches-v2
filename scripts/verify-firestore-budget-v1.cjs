const fs = require("fs");

const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  route: read("src/app/api/public/catalog/route.ts"),
  client: read("src/lib/publicCatalogClient.ts"),
  catalog: read("src/hooks/useCatalog.ts"),
  categories: read("src/hooks/useCatalogCategories.ts"),
  status: read("src/hooks/useShopStatus.ts"),
};

const checks = [
  ["catálogo possui snapshot materializado compartilhado", files.route.includes('SNAPSHOT_DOCUMENT = "catalog_v1"')],
  ["cache server continua ativo", files.route.includes("unstable_cache") && files.route.includes("revalidate: 3600")],
  ["hit materializado custa uma leitura documental", files.route.includes("firestoreDocuments: 1")],
  ["full scan só existe no rebuild", files.route.includes("async function rebuildCatalogSnapshot")],
  ["browser tem autoridade única do catálogo", files.client.includes("let inflight: Promise<State> | null = null")],
  ["produtos usam cliente compartilhado", files.catalog.includes("subscribePublicCatalog")],
  ["categorias usam o mesmo cliente compartilhado", files.categories.includes("subscribePublicCatalog")],
  ["não existem dois fetches de /api/public/catalog nos hooks", !files.catalog.includes('fetch("/api/public/catalog"') && !files.categories.includes('fetch("/api/public/catalog"')],
  ["status público entrou na telemetria local", files.status.includes('recordFirestoreReadEstimate("public.settings.loja"')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERRO"}: ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`\n${failed} contrato(s) Firestore Budget V1 falharam.`);
  process.exit(1);
}
console.log("\nFIRESTORE BUDGET V1: contratos estáticos OK");
