import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const a=read('src/hooks/useShopStatus.ts'),b=read('src/hooks/useLastCustomerOrder.ts'),c=read('src/components/home/LastOrderCard.tsx'),d=read('src/components/layout/Header.tsx'),e=read('src/app/page.tsx'),css=read('src/app/page.module.css');
const tests=[
 ['status nao consulta enquanto aba oculta',a.includes('document.visibilityState === "visible") void load(true)')],
 ['retorno online/visivel recupera status com TTL',a.includes('visibilitychange", recoverVisibleStatus')&&a.includes('window.addEventListener("online", recoverVisibleStatus)')&&a.includes('void load();')],
 ['listeners limpos sem assinatura por componente',a.includes('removeEventListener("online", recoverVisibleStatus)')&&a.includes('removeEventListener("visibilitychange", recoverVisibleStatus)')],
 ['ultimo pedido habilitavel sem mudar API antiga',b.includes('enabled = true')&&b.includes('if (!enabled) return;')],
 ['ultimo pedido evita historico enquanto pedido ativo',c.includes('!activeLoading && activeOrders.length === 0')],
 ['troca de conta limpa dados do card',b.includes('setState({ order: null, loading: true, error: "", at: 0 })')],
 ['miniaturas do ultimo pedido usam imagem otimizada',c.includes('<CatalogImage')&&c.includes('sizes="64px"')],
 ['busca do Header persiste apenas transicao entre paginas',d.includes('dfl:pending-catalog-search')&&d.includes('pathname !== "/"')],
 ['buscas da Home e Header se sincronizam',e.includes('detail: search')&&d.includes('addEventListener(CATALOG_SEARCH_EVENT, syncSearch)')],
 ['busca da pagina interna recuperada sem dependencia remota',e.includes('sessionStorage.removeItem("dfl:pending-catalog-search")')],
 ['ofertas so exibem categorias visiveis',e.includes('categories.some((category) => category.id === product.category)')&&e.includes('[products, categories]')],
 ['preco e descricoes das ofertas legiveis',css.includes('DFL V85.1 R9 - PROMO LEGIBILITY')&&css.includes('.promoHeroCopy>small{font-size:10px')],
 ['R3 busca publica continua acessivel',e.includes('styles.cardActionArea')&&e.includes('styles.searchSummary')],
 ['R7 convidado nao aparece para conta Google',e.includes('!currentUser && guestLastOrder')],
 ['consulta do catalogo e compartilhada',read('src/lib/publicCatalogClient.ts').includes('const listeners = new Set')],
 ['nenhuma alteracao no checkout/servicos',read('src/components/ui/CheckoutModal.tsx').includes('clientRequestId')],
];
for(const [name,pass] of tests){assert.ok(pass,'R9: '+name);console.log('✓',name)}
console.log('DFL SITE V85.1 R9 — 16 CONTRATOS APROVADOS');
