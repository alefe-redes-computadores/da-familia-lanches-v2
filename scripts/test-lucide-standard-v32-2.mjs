import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V32.2: ${m}`);};

const pkg=JSON.parse(read("package.json"));
const admin=read("src/app/admin/page.tsx");
const center=read("src/components/admin/AdminNotificationCenter.tsx");
const card=read("src/components/layout/OrderCard.tsx");
const drawer=read("src/components/layout/MobileDrawerMenu.tsx");
const product=read("src/components/product/ProductPublicPage.tsx");
const auth=read("src/components/auth/LoginModal.tsx");
const adminAuth=read("src/components/admin/AdminAuthGate.tsx");

ok(Boolean(pkg.dependencies?.["lucide-react"]),"lucide-react ausente em dependencies");
ok(admin.includes('from "lucide-react"')&&admin.includes("ChefHat")&&admin.includes("ClipboardList")&&admin.includes("Bell"),"Admin shell não padronizado");
ok(center.includes('from "lucide-react"')&&center.includes("BellRing")&&center.includes("RefreshCw"),"Central V32 sem Lucide");
ok(card.includes('from "lucide-react"')&&card.includes("MessageCircle")&&card.includes("CreditCard"),"Inspector V32 sem Lucide");
ok(drawer.includes('from "lucide-react"')&&drawer.includes("ShoppingCart")&&drawer.includes("MessageCircle"),"menu mobile sem Lucide");
ok(product.includes('from "lucide-react"')&&product.includes("ShoppingCart")&&product.includes("Share2"),"produto público sem Lucide");
ok(!product.includes("const CartIcon = () => <svg"),"carrinho artesanal ainda presente");
ok(!admin.includes("return <svg {...common}>"),"SVG artesanal do Admin ainda presente");
ok(!drawer.includes("return <svg aria-hidden"),"SVG artesanal do menu ainda presente");

// Logos oficiais do Google são marca, não devem virar ícone Lucide.
ok(auth.includes("<svg"),"logo Google do login público foi removido");
ok(adminAuth.includes("<svg"),"logo Google do login Admin foi removido");

console.log("DFL V32.2 — LUCIDE STANDARD — ZERO ERROS");
