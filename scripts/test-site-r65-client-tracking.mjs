import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
const comp=read('src/components/tracking/TrackingLinkEntry.tsx');
const compCss=read('src/components/tracking/TrackingLinkEntry.module.css');
const home=read('src/components/home/OrderTrackingInfoCard.tsx');
const homeCss=read('src/components/home/OrderTrackingInfoCard.module.css');
const orders=read('src/components/ui/OrdersModal.tsx');
const ordersCss=read('src/components/ui/OrdersModal.module.css');
const successCss=read('src/components/ui/OrderSuccessModal.module.css');
const activeCss=read('src/components/ui/ActiveOrderBanner.module.css');
let n=0;
const ok=(pass,label)=>{assert.ok(pass,`R65: ${label}`);n++;console.log('OK:',label)};
for(const [name,s] of [['TrackingLinkEntry.tsx',comp],['OrderTrackingInfoCard.tsx',home],['OrdersModal.tsx',orders]]){
 const sf=ts.createSourceFile(name,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(sf.parseDiagnostics.length===0,'TSX válido '+name);
}
ok(comp.includes('if (!available) return null') && comp.includes("cache: 'no-store'") && comp.includes('controller.abort()'),'capability fail-closed e sem cache');
ok(comp.includes('parseTrackingLink(input, window.location.origin)'),'parser oficial do link');
ok(comp.includes('window.location.assign(target)') && !comp.includes('style={{'),'navegacao real sem estilos inline');
ok(!/localStorage|sessionStorage|navigator\.clipboard|console\./.test(comp.replace(/\/\/[^\n]*/g,'')),'sem reter ou logar token');
ok(!/issueGrant\(|r25SendInitialOnce\(|setDoc\(|onSnapshot\(/.test(comp),'sem emissao e sem novas assinaturas');
ok(comp.includes('não libera o acesso')&&comp.includes('número do pedido'),'numero simples nunca concede link');
ok(comp.includes('onSubmit={open}') && comp.includes('type="submit"') && comp.includes('role="alert"'),'formulario funcional e erro acessivel');
ok(compCss.includes('.reveal')&&compCss.includes('.open')&&compCss.includes('.field input')&&compCss.includes(':focus-visible'),'componente premium e teclado');
ok(home.includes('className={styles.primaryAction}')&&home.indexOf('className={styles.primaryAction}')<home.indexOf('<details className={styles.disclosure}>'),'CTA Home visivel antes de detalhes');
ok(home.includes('Seu pedido, acompanhado de verdade')&&home.includes('quando o acompanhamento é liberado para aquele pedido'),'promessa condicionada preservada');
ok(home.includes('onClick={() => openModal("orders")}')&&home.includes('Como funciona'),'navegacao e explicacao preservadas');
ok(home.split('onClick={() => openModal("orders")}').length===2,'um unico CTA Home');
ok(homeCss.includes('DFL R65')&&homeCss.includes('.primaryAction')&&homeCss.includes('.features li'),'hierarquia premium Home');
ok(orders.includes('<TrackingLinkEntry />')&&orders.includes('<ShoppingBag size={27}'),'Meus Pedidos e ícone real');
ok(ordersCss.includes('DFL R65')&&ordersCss.includes('.step span{font-size:10px')&&ordersCss.includes('.scheduleActions button'),'legibilidade historico e agendamento');
ok(activeCss.includes('DFL R65')&&activeCss.includes('.bottom button'),'banner do pedido com CTA');
ok(successCss.includes('DFL R65')&&successCss.includes('.primary{min-height:51px'),'pedido recebido com CTA consistente');
for(const [path,s] of [['link',compCss],['home',homeCss],['orders',ordersCss],['success',successCss],['active',activeCss]]){
  try{const postcss=await import('postcss');postcss.default.parse(s,{from:path+'.css'});ok(true,'CSS parse '+path)}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND'){const clean=s.replace(/\/\*[\s\S]*?\*\//g,'');let depth=0;for(const char of clean){if(char==='{')depth++;if(char==='}')depth--;assert.ok(depth>=0,'CSS premature '+path)}ok(depth===0,'CSS braces '+path)}else throw e}
}
console.log(`R65 CLIENTE TRACKING: ${n} contratos hermeticos OK. Sem envio nem banco.`);
