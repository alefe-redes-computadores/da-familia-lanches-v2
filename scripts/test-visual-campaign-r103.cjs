'use strict';
/* R103 campaign rules run locally. No Firebase, HTTP or real orders. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('src/lib/visualCampaigns.ts','utf8');
const out=ts.transpileModule(source,{fileName:'visualCampaigns.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const mod={exports:{}};new Function('module','exports',out.outputText)(mod,mod.exports);
const {DEFAULT_VISUAL_CAMPAIGNS:presets,normalizeCampaignList,chooseVisualCampaign,brazilDate,validCampaignImage,colorContrast}=mod.exports;
let count=0;const check=(msg,fn)=>{fn();console.log('✓',msg);count++};
check('Tres presets gerais sem logica fixa de data no tema',()=>{assert.equal(presets.length,3);assert.equal(new Set(presets.map(x=>x.id)).size,3)});
check('Black Friday 30/10–30/11 inclusive em Brasilia',()=>{assert(chooseVisualCampaign(presets,'2026-10-30')?.id.includes('black-friday'));assert(chooseVisualCampaign(presets,'2026-11-30')?.id.includes('black-friday'));assert.equal(chooseVisualCampaign(presets,'2026-12-01'),null)});
check('Natal e ano novo sao rascunhos, nao entram sozinhos',()=>{assert.equal(presets[1].status,'draft');assert.equal(presets[2].status,'draft');assert.equal(chooseVisualCampaign(presets,'2026-12-24'),null)});
check('Agendamento automatico, empate resolvido por prioridade',()=>{const a={...presets[1],status:'scheduled',priority:90};assert.equal(chooseVisualCampaign([a],'2026-12-01')?.id,a.id);const b={...a,id:'outra-campanha',priority:91};assert.equal(chooseVisualCampaign([a,b],'2026-12-20')?.id,b.id)});
check('Pausa restaura tema padrao',()=>{const a={...presets[0],status:'paused'};assert.equal(chooseVisualCampaign([a],'2026-11-01'),null)});
check('Brasilia a partir de UTC diferencia virada do dia',()=>{assert.equal(brazilDate(new Date('2026-12-01T02:59:00Z')),'2026-11-30');assert.equal(brazilDate(new Date('2026-12-01T03:00:00Z')),'2026-12-01')});
check('Nao permite imagem remota arbitraria nem javascript',()=>{assert(validCampaignImage('/img/campaign/black-friday-da-familia.webp'));assert(!validCampaignImage('javascript:alert(1)'));assert(!validCampaignImage('https://evil.example/banner.webp'))});
check('Nao permite URL de clique externa, esquema inseguro ou API',()=>{for(const url of ['https://evil.example','//evil.example','javascript:alert(1)','/api/orders'])assert.throws(()=>normalizeCampaignList([{...presets[0],destination:'url',destinationUrl:url}]));assert(normalizeCampaignList([{...presets[0],destination:'url',destinationUrl:'/promocoes'}]))});
check('Contraste minimo e configuracao estrita',()=>{assert(colorContrast('#FACC15','#0B0B0D')>4.5);assert.throws(()=>normalizeCampaignList([{...presets[0],palette:{...presets[0].palette,buttonText:'#FACC15'}}]));assert.throws(()=>normalizeCampaignList([{...presets[0],palette:{...presets[0].palette,button:'red'}}]))});
check('Nao permite datas invalidas ou inversas',()=>{for(const dates of [{startsOn:'2026-11-31'},{endsOn:'2026-10-01'}])assert.throws(()=>normalizeCampaignList([{...presets[0],...dates}]))});
check('Sem duplicacao de campanhas',()=>assert.throws(()=>normalizeCampaignList([presets[0],presets[0]])));
const read=p=>fs.readFileSync(p,'utf8');
const admin=read('src/app/api/admin/visual-campaigns/route.ts');
const upload=read('src/app/api/admin/visual-campaign-image/route.ts');
const publicRoute=read('src/app/api/public/visual-campaigns/route.ts');
const home=read('src/app/page.tsx');
const shell=read('src/components/layout/AppShell.tsx');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const orderApi=read('src/app/api/orders/route.ts');
check('Admin exige token validado e lista de permissao',()=>{for(const s of [admin,upload])assert(s.includes('verifyIdToken')&&s.includes('isAdminEmail'))});
check('API publica tem cache e fallback sem mutacao',()=>{assert(publicRoute.includes('unstable_cache')&&publicRoute.includes('revalidate: 120'));assert(!/setDoc\(|\.set\(/.test(publicRoute))});
check('Banner e tema exclusivamente visuais, sem preco artificial',()=>{assert(home.includes('campaignMatchesCatalogOffer'));assert(home.includes('campaign.scopes.includes("home")'));assert(home.includes('VisualCampaignBanner'));assert(shell.includes('VisualCampaignProvider'));assert(!/createCustomerOrder|updateOrderStatus|addDoc\(|setDoc\(/.test(read('src/components/layout/VisualCampaignBanner.tsx')))});
check('Banner tem prioridade e Assist na Home nao duplica chamada',()=>{
 assert(!home.includes('className={styles.r102AssistEntry}'));
 assert(home.includes('data-first-hint={assistFirstHint}'));
 assert(home.includes('dfl-assist-first-hint-r103'));
 assert(read('src/app/page.module.css').includes('dflAssistWelcomeR103'));
 assert(read('src/app/page.module.css').includes('prefers-reduced-motion:reduce'));
});
check('Carrossel de ofertas permanece sem duplicacao',()=>{assert(home.includes('promoProducts.slice(0, 4)'));assert(home.includes('new Set(promoProducts.map((product) => product.id))'))});
check('Checkout e pedidos permanecem protegidos',()=>{for(const s of ['orderAttemptRef.current','confirmedOrderId = created.id','createCustomerOrder'])assert(checkout.includes(s),s);assert(orderApi.includes('requestFingerprint')&&orderApi.includes('tx.create(orderRef, canonicalOrder)'))});
check('Carregamento WebP com arquivo e assinatura reais',()=>{assert(upload.includes('RIFF')&&upload.includes('WEBP')&&upload.includes('createHash'));assert(read('src/lib/campaignImageClient.ts').includes('canvas.toBlob'))});
check('Workflow Android e vendas contêm gate R103',()=>{for(const p of ['.github/workflows/build-admin-android.yml','.github/workflows/site-sales-protection.yml'])assert(read(p).includes('node scripts/test-visual-campaign-r103.cjs'),p)});
check('Sem listeners extras Firestore no tema',()=>{for(const p of ['src/components/layout/VisualCampaignProvider.tsx','src/components/layout/VisualCampaignBanner.tsx'])assert(!/onSnapshot\(|getDoc\(|getDocs\(/.test(read(p)))});
check('JSX e TypeScript de todos os arquivos novos sintaticamente corretos',()=>{
 for(const p of ['src/lib/visualCampaigns.ts','src/lib/campaignImageClient.ts','src/components/layout/VisualCampaignProvider.tsx','src/components/layout/VisualCampaignBanner.tsx','src/components/admin/VisualCampaignsAdmin.tsx','src/app/api/admin/visual-campaigns/route.ts','src/app/api/public/visual-campaigns/route.ts','src/app/api/admin/visual-campaign-image/route.ts']){
  const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length,0,`${p}: syntax error`);
 }
});
console.log(`\nDFL R103 — ${count} contratos locais aprovados. 0 writes Firebase, checkout intocado.`);
