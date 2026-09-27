import fs from "node:fs";

const admin=fs.readFileSync(
  "src/app/admin/page.tsx",
  "utf8"
);

const smart=fs.readFileSync(
  "src/lib/smartCart.ts",
  "utf8"
);

const commercial=fs.readFileSync(
  "src/lib/commercialRecommendations.ts",
  "utf8"
);

const rescue=fs.readFileSync(
  "src/components/ui/OrderRescueActions.tsx",
  "utf8"
);

const heavy=[
  "RelatoriosAdmin",
  "CatalogAdmin",
  "StoreOperationAdmin",
  "SchedulingAdmin",
  "RewardsAdmin",
  "CouponsAdmin",
  "PublicPromotionsAdmin",
  "FirestoreBudgetAdmin",
  "FreeDeliveryAdmin",
  "DeliveryRatesAdmin",
];

const tests=[];

tests.push([
  admin.includes('from "next/dynamic"') ||
  admin.includes("from 'next/dynamic'"),
  "Admin usa next/dynamic",
]);

for(const name of heavy){
  tests.push([
    new RegExp(
      `const\\s+${name}\\s*=\\s*dynamic\\s*\\(`
    ).test(admin),
    `${name} lazy`,
  ]);
}

tests.push([
  smart.includes("getDailySeed") &&
  smart.includes("rotationKey"),
  "Smart Cart mantém diversidade diária",
]);

tests.push([
  smart.includes("upsellProductId") &&
  smart.includes("upsellUnitPrice"),
  "upsell explícito preservado",
]);

tests.push([
  smart.includes("matchingCombo"),
  "combo econômico preservado",
]);

tests.push([
  smart.includes("const complements = available"),
  "pool de complementos preservado",
]);

tests.push([
  commercial.includes("stableHash"),
  "Commercial Recommendations mantém ranking determinístico",
]);

tests.push([
  rescue.includes("navigator.share"),
  "Rescue mantém compartilhamento nativo",
]);

tests.push([
  rescue.includes("clipboard"),
  "Rescue mantém cópia",
]);

tests.push([
  !rescue.includes("onSnapshot(") &&
  !rescue.includes("getDoc(") &&
  !rescue.includes("getDocs("),
  "Rescue sem Firestore",
]);

let failed=false;

for(const [ok,label] of tests){
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if(!ok) failed=true;
}

if(failed){
  process.exit(1);
}

console.log(
  "\nROADMAP FINAL V2 — CONTRATO OK"
);
