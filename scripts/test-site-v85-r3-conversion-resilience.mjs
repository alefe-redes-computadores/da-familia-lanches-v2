import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");
const check = (condition, label) => {if (!condition) throw new Error("V85 R3: " + label); console.log("✓", label);};
const image = read("src/lib/catalogImageClient.ts");
const api = read("src/app/api/admin/catalog-image/route.ts");
const client = read("src/lib/publicCatalogClient.ts");
const home = read("src/app/page.tsx");
const checkout = read("src/components/ui/CheckoutModal.tsx");
const adminOrders = read("src/hooks/useAdminOrders.ts");
const r1 = read("src/components/product/ProductPublicPage.tsx");
const r2 = read("src/components/admin/CatalogAdmin.tsx");
check(image.includes("for (const factor of [1, 0.84, 0.70, 0.58, 0.48])") && image.includes("CATALOG_IMAGE_TARGET_BYTES"), "fotos densas reduzem resolucao e peso progressivamente");
check(image.includes('blob.type !== "image/webp"') && image.includes('throw new Error("IMAGE_TOO_LARGE_AFTER_COMPRESSION")'), "upload falha claramente em vez de enviar PNG ou arquivo acima do limite");
check(api.includes("640 * 1024") && api.includes('new Set(["image/webp"])'), "contrato do servidor permanece intacto");
check(client.includes("window.addEventListener(\"online\", recoverOnConnection)") && client.includes('document.addEventListener("visibilitychange", recoverOnVisibility)'), "recuperacao do cardapio em retorno de rede");
check(client.includes('payload: state.payload') && client.includes('RECOVERY_COOLDOWN_MS = 30_000'), "fallback nao apaga catalogo e nao cria polling");
check(client.includes('listeners.size === 0') && client.includes('window.removeEventListener("online"'), "eventos compartilhados sao limpos ao desmontar");
check(home.includes('useDeferredValue(search)') && home.includes('normalize(deferredSearch)'), "busca publica prioriza digitação fluida");
check(checkout.includes('let timer: number | undefined') && checkout.includes('window.setTimeout(() => reject(new Error("COUPON_CHECK_TIMEOUT"))'), "timer de cupom usa tipo DOM, compativel com TypeScript e Node");
check(checkout.includes('couponCodeRef.current = recoveredCoupon') && checkout.includes('setCouponCode(recoveredCoupon)'), "cupom recuperado mantem ref de validacao sincronizada");
check(checkout.includes('!/^[A-Z0-9_-]{1,32}$/.test(code)') && checkout.includes('COUPON_CHECK_TIMEOUT'), "cupom invalido recebe erro local e consulta tem timeout");
check(checkout.includes('maxLength={32}') && checkout.includes('void applyCoupon();'), "campo de cupom aceita Enter e tamanho limitado");
check(checkout.includes('createCustomerOrder(') && checkout.includes('clearConfirmedCart()'), "autoridade do pedido e limpeza segura preservadas");
check(r1.includes('openModal("product-details", product)') && r2.includes('closeProductEditor'), "R1 e R2 preservadas");
check((adminOrders.match(/onSnapshot\s*\(/g) || []).length === 1, "listener de pedidos continua unico");
console.log("DFL SITE V85 R3 — CONTRATOS APROVADOS");
// Runtime isolado: nenhuma conexao Firebase, pedido ou upload real.
// Testa o processamento de imagem com canvas simulado e a recuperacao de catalogo.
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
const compileCjs = (path) => ts.transpileModule(read(path), {
  fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
}).outputText;
const delay = () => new Promise(resolve => setTimeout(resolve, 0));
class FakeFile {
  constructor(parts, name, options = {}) {
    this.size = parts.reduce((sum, part) => sum + (part.size ?? 0), 0);
    this.name = name;
    this.type = options.type ?? "";
  }
}
const runImageCase = async (kind) => {
  const exports = {};
  let lastWidth = 0;
  class FakeImage {
    naturalWidth = 1600;
    naturalHeight = 1600;
    set src(_value) { this.onload?.(); }
  }
  const context = {
    exports, Promise, Date, Error, File: FakeFile,
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} },
    Image: FakeImage,
    document: { createElement: () => {
      const canvas = { width: 0, height: 0,
        getContext: () => ({fillRect: () => {}, drawImage: () => {}, set fillStyle(_value) {}}),
        toBlob(callback) {
          lastWidth = canvas.width;
          callback({type: kind === "png" ? "image/png" : "image/webp",
            size: kind === "heavy" ? 900_000 : Math.round(canvas.width * canvas.height * .53)});
        },
      };
      return canvas;
    }},
  };
  vm.runInNewContext(compileCjs("src/lib/catalogImageClient.ts"), context);
  const promise = exports.prepareCatalogImage({name: "foto-principal.png", type: "image/png"});
  if (kind === "png") await assert.rejects(promise, /WEBP_NOT_SUPPORTED/);
  else if (kind === "heavy") await assert.rejects(promise, /IMAGE_TOO_LARGE_AFTER_COMPRESSION/);
  else {
    const result = await promise;
    assert.equal(result.type, "image/webp");
    assert.match(result.name, /\.webp$/);
    assert.ok(result.size <= 520 * 1024);
    assert.ok(lastWidth < 1280 && lastWidth > 0);
  }
};
await runImageCase("normal");
await runImageCase("png");
await runImageCase("heavy");
console.log("✓ WebP runtime: reduz dimensoes, rejeita formato errado e limite irredutivel");

const events = new Map();
let requests = 0;
let failRequest = true;
const listeners = new Map();
const mockWindow = {
  addEventListener: (name, callback) => listeners.set("w:" + name, callback),
  removeEventListener: (name) => listeners.delete("w:" + name),
};
const mockDocument = {
  visibilityState: "visible",
  addEventListener: (name, callback) => listeners.set("d:" + name, callback),
  removeEventListener: (name) => listeners.delete("d:" + name),
};
const catalogExports = {};
vm.runInNewContext(compileCjs("src/lib/publicCatalogClient.ts"), {
  exports: catalogExports, Promise, Date, console,
  window: mockWindow, document: mockDocument,
  navigator: {onLine: true},
  fetch: () => {
    requests++;
    return failRequest ? Promise.reject(new Error("offline")) : Promise.resolve({
      ok: true, json: async () => ({products: [{id: "recuperado", data: {id: "recuperado"}}], addons: [], categories: []}),
    });
  },
});
const received = [];
const stop = catalogExports.subscribePublicCatalog(value => received.push(value));
for (let i = 0; i < 6; i++) await delay();
assert.equal(requests, 1);
assert.ok(catalogExports.readPublicCatalog().error);
failRequest = false;
listeners.get("w:online")?.();
for (let i = 0; i < 6; i++) await delay();
assert.equal(requests, 2);
assert.equal(catalogExports.readPublicCatalog().payload.products[0].id, "recuperado");
listeners.get("w:online")?.();
await delay();
assert.equal(requests, 2, "catalogo nao consulta se estado ja esta valido");
stop();
assert.ok(!listeners.has("w:online") && !listeners.has("d:visibilitychange"));
console.log("✓ Catalogo runtime: falha inicial, retorno online, recuperação sem polling/listener duplicado");
