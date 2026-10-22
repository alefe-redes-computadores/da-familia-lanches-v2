import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path,'utf8');
const site=read('src/app/page.tsx');
const admin=read('src/app/admin/page.tsx');
const siteCss=read('src/app/page.module.css');
const adminCss=read('src/app/admin/admin.module.css');
const checks = [
 ['busca publica nao fica presa a uma categoria',site.includes('if (event.target.value.trim()) setActiveCategory("todos")')],
 ['resultado de busca explicito e reativo',site.includes('className={styles.searchSummary}') && site.includes('{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}')],
 ['acao limpar restabelece categorias e busca',site.includes('onClick={() => { setSearch(""); setActiveCategory("todos"); }}>Limpar')],
 ['acessibilidade da lista preserva artigo e clique via botao sem aninhar',site.includes('className={styles.cardActionArea}') && site.includes('aria-label={`Ver detalhes e personalizar ${product.name}`}')],
 ['article nao mais captura cliques de filho',!site.includes('key={product.id} onClick={() => available && openProduct(product)}')],
 ['promocao por teclado nao desloca pagina',site.includes('event.preventDefault(); openProduct(product);')],
 ['acao de abrir produto acessivel e destaque de foco',siteCss.includes('.cardActionArea:focus-visible') && siteCss.includes('.card .addButton{position:relative;z-index:3}')],
 ['interface do catalogo nao perde cupom ou checkout',site.includes('<ActiveOrderBanner />') && site.includes('<LastOrderCard />') && site.includes('openModal("product-details", product)')],
 ['filtros do Admin visiveis com contador',admin.includes('className={styles.filterSummary}') && admin.includes('{filtered.length} {filtered.length === 1 ? "pedido encontrado"')],
 ['limpar filtros reverte busca, alerta e tipo',admin.includes('setAttentionOnly(false);\n                  setServiceFilter("todos");')],
 ['foco do inspetor vai ao fechamento e retorna ao disparador',admin.includes('data-admin-inspector-close="true"') && admin.includes('origin?.isConnected') && admin.includes('querySelector<HTMLButtonElement>')],
 ['hook de foco antes de retornos condicionais',admin.indexOf('querySelector<HTMLButtonElement>') < admin.indexOf('if (!currentUser) {')],
 ['gestao continua com isolamento R1 R2',admin.includes('AdminSectionBoundary section="Saúde e relatórios"') && admin.includes('section={"Relatórios"}')],
 ['adicionais e pagamento no card continuam',read('src/components/layout/OrderCard.tsx').includes('paymentBreakdown') && read('src/components/layout/OrderCard.tsx').includes('formatBRL')],
 ['R1 e R2 continuam presentes',adminCss.includes('DFL V85.1 R2 - MOBILE OPERATION DENSITY') && adminCss.includes('DFL V85.1 - ADAPTIVE INSPECTOR SHEET')],
 ['nenhum novo listener no Admin', (read('src/hooks/useAdminOrders.ts').match(/onSnapshot\s*\(/g)||[]).length === 1],
];
for(const [name, pass] of checks){assert.ok(pass,`V85.1 R3: ${name}`);console.log('✓',name)}
console.log('\nV85.1 R3 — 16 CONTRATOS DE UX / ACESSIBILIDADE OK');
