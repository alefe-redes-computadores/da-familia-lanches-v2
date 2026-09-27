import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const ok = (value, label) => {
  if (!value) {
    console.error("FAIL:", label);
    process.exitCode = 1;
  } else {
    console.log("OK  :", label);
  }
};

const contact = read("src/lib/businessContact.ts");
const rescue = read("src/components/ui/OrderRescueActions.tsx");
const success = read("src/components/ui/OrderSuccessModal.tsx");
const checkout = read("src/components/ui/CheckoutModal.tsx");
const admin = read("src/app/admin/admin.module.css");

ok(contact.includes("instagramUrl"), "contato possui Instagram canônico");
ok(contact.includes("dafamilia_patos"), "Instagram correto");
ok(rescue.includes("navigator.share"), "rescue oferece compartilhamento nativo");
ok(rescue.includes("navigator.clipboard"), "rescue oferece cópia");
ok(rescue.includes("whatsappUrl"), "rescue preserva WhatsApp");
ok(success.includes("OrderRescueActions"), "sucesso usa Rescue Center");
ok(success.includes("rescueMessage"), "sucesso recebe snapshot da mensagem");
ok(checkout.includes("rescueMessage: whatsappMessage"), "checkout entrega mensagem canônica");
ok(admin.includes("DFL CONTROL"), "Admin recebeu identidade DFL Control");

const firestoreTokens = [
  "firebase/firestore",
  "onSnapshot(",
  "getDocs(",
  "getDoc(",
  "collection(",
  "query("
];

for (const token of firestoreTokens) {
  ok(!rescue.includes(token), `Rescue sem Firestore: ${token}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log("\nRESCUE + ADMIN V2 — CONTRATO OK");
