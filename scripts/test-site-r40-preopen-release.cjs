"use strict";
/** DFL SITE R40: gate de pre-abertura sem I/O remoto ou pedido ficticio. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
function check(ok,label){assert.ok(ok,label);console.log('✓',label);checks++;}
const checkout=read('src/components/ui/CheckoutModal.tsx');
const checkoutCss=read('src/components/ui/CheckoutModal.module.css');
const district=read('src/components/ui/DistrictQuickPicker.tsx');
const districtCore=read('src/lib/districtCatalog.ts');
const support=read('src/lib/addressSupportMessage.ts');
const preview=read('src/components/ui/AddressMapPreview.tsx');
const previewApi=read('src/app/api/address/preview/route.ts');
const previewCore=read('src/lib/addressPreviewCore.ts');
const admin=read('src/components/admin/OperationHealthAdmin.tsx');
const adminCore=read('src/lib/operationPreopenChecklist.ts');
const authOrders=read('src/lib/orderRepository.ts');
const guestOrders=read('src/app/api/orders/route.ts');
const fallback=read('src/lib/checkoutFallbackSafety.ts');
const outcome=read('src/lib/orderOutcomeRecovery.ts');
const streets=read('src/components/ui/StreetSuggestions.tsx');
for(const path of [
  'scripts/test-site-r38-district-fallback.cjs',
  'scripts/test-site-r39-geoapify-preview.cjs',
  'scripts/test-site-r39-preopen-guard.cjs',
  'scripts/test-site-r37-release-gate.cjs',
])check(fs.existsSync(path),`suite presente: ${path}`);
for(const [ok,label] of [
  [checkout.includes('DFL-R38-REACTIVE-DISTRICTS')&&checkout.includes('DFL-R38-ADDRESS-CATALOG'),'R38 seletor continua conectado'],
  [checkout.includes('DistrictQuickPicker')&&checkout.includes('onOpen={openDistrictCatalog}'),'lista chama tabela apenas quando aberta'],
  [checkout.includes('getDeliveryTableCached()')&&checkout.includes('matchDeliveryRate'),'frete continua pela tabela da loja'],
  [district.includes('onSelect(name)')&&district.includes('onOpen()'),'bairro so muda por escolha explicita'],
  [districtCore.includes('KNOWN_PATOS_DISTRICTS')&&!districtCore.includes('createCustomerOrder'),'lista referencial nao gera pedido'],
  [support.includes('buildDistrictSupportMessage')&&support.includes('bairro'),'fallback humano conserva contexto'],
  [checkout.includes('StreetSuggestions street={rua} district={bairro}'),'sugestao de rua anterior preservada'],
  [streets.includes('AbortController')&&streets.includes('STREET_CACHE_TTL'),'busca de rua tem timeout e cache'],
  [checkout.includes('DFL-R39-GEOAPIFY-ON-DEMAND')&&checkout.includes('<AddressMapPreview district={bairro} street={rua} number={numero} />'),'mapa sob demanda integrado'],
  [preview.includes('NEXT_PUBLIC_DFL_ADDRESS_PREVIEW_ENABLED')&&preview.includes('onClick={()=>void query()}'),'visualizacao opt-in por configuracao e clique'],
  [preview.includes('AbortController')&&preview.includes('controller.current?.abort()'),'consultas cancelam resposta anterior'],
  [preview.includes('Não é cotação de frete'),'distancia nunca se apresenta como taxa'],
  [previewApi.includes('GEOAPIFY_ADDRESS_PREVIEW_ENABLED')&&previewApi.includes('GEOAPIFY_API_KEY'),'chave secreta mantida no servidor'],
  [previewApi.includes('GEOAPIFY_ROUTE_PREVIEW_ENABLED')&&previewApi.includes('DFL_STORE_LAT')&&previewApi.includes('DFL_STORE_LON'),'rota geografia desativada por padrao'],
  [previewApi.includes('RATE_LIMITED')&&previewApi.includes('ORIGIN_DENIED')&&previewApi.includes('AbortController'),'endpoint limita abuso, origem e timeout'],
  [previewApi.includes('cache:"no-store"')&&!previewApi.includes('createCustomerOrder'),'endpoint nao envia pedido nem armazena cache publico'],
  [previewCore.includes('"confirmed" | "review" | "not_found"'),'resultado de mapa nao finge certeza'],
  [admin.includes('inspectPreopenChecklist')&&admin.includes('DFL-R39-PREOPEN'),'admin exibe pre-abertura'],
  [admin.includes('remoteError:Boolean(remoteError)')&&admin.includes('remote?.integration.backlog??null'),'admin não oculta erro remoto'],
  [adminCore.includes('unknown')&&adminCore.includes('remoteState===null'),'sem consulta nao significa saudavel'],
  [authOrders.includes('runTransaction(')&&authOrders.includes('ensureIntegrationEventInTransaction('),'pedidos autenticados e evento atomicos'],
  [guestOrders.includes('runTransaction(')&&guestOrders.includes('buildOutboxRecord('),'pedidos convidados e evento atomicos'],
  [guestOrders.includes('sourceSystem: "dfl_site"')&&guestOrders.includes('drainIntegrationOutboxEvent('),'origem Site e envio de outbox preservados'],
  [checkout.includes('orderAttemptRef')&&checkout.includes('orderOutcomeUncertain'),'protecoes contra duplicidade mantidas'],
  [checkout.includes('!orderOutcomeUncertain && fallbackWhatsAppUrl')&&checkout.includes('canOfferManualOrderFallback(code)'),'WhatsApp nao duplica pedido incerto'],
  [fallback.includes('SERVICE_CONFIG')&&outcome.includes('EXPLICIT_REJECTIONS'),'fallback manual somente sob recusa explicita'],
  [checkout.includes('const canAdvance = nameReady && phoneReady && addressReady && items.length > 0'),'validacoes originais mantidas'],
  [checkoutCss.includes('.addressFirstGuide')&&checkoutCss.includes('.addressFirstField'),'layout de endereco anterior preservado'],
  [!/(?:createCustomerOrder|addDoc|setDoc|runTransaction)\s*\(/.test(previewCore+adminCore+districtCore),'motores de apoio sem escrita remota'],
  [!preview.includes('GEOAPIFY_API_KEY')&&!district.includes('GEOAPIFY_API_KEY'),'segredo nao aparece no frontend'],
])check(ok,label);
for(const path of [
  'src/components/ui/CheckoutModal.tsx',
  'src/components/ui/DistrictQuickPicker.tsx',
  'src/components/ui/AddressMapPreview.tsx',
  'src/components/admin/OperationHealthAdmin.tsx',
  'src/lib/addressPreviewCore.ts',
  'src/lib/operationPreopenChecklist.ts',
  'src/lib/districtCatalog.ts',
  'src/lib/addressSupportMessage.ts',
  'src/app/api/address/preview/route.ts',
]){
  const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  check(ast.parseDiagnostics.length===0,`sintaxe TS/TSX: ${path}`);
}
console.log(`R40 PRE-ABERTURA: ${checks} contratos aprovados; nenhum pedido criado.`);
