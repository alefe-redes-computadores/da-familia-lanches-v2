'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let n = 0;
const ok=(v,label)=>{assert.ok(v,label);n++};
const src=fs.readFileSync('src/lib/tracking/client-link.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};
Function('module','exports',js)(m,m.exports);
const parse=m.exports.parseTrackingLink;
const origin='https://dafamilialanches.com.br';
const token='A'.repeat(43);
const good=origin+'/acompanhar#t='+token;
ok(parse(good,origin)===good,'valid same-origin link');
for(const bad of [
  'http://dafamilialanches.com.br/acompanhar#t='+token,
  'https://evil.example/acompanhar#t='+token,
  'https://dafamilialanches.com.br.evil.example/acompanhar#t='+token,
  origin+'/acompanhar?x=1#t='+token,
  origin+'/acompanhar#t=wrong',
  origin+'/acompanhar#t='+token+'!',
  origin+'/outra#t='+token,
  'javascript:alert(1)',
  ' '+good,
  good+' ',
  '/acompanhar#t='+token,
  origin+'/acompanhar?redirect=https://evil.example#t='+token,
])ok(parse(bad,origin)===null,'reject invalid URL: '+bad.slice(0,30));
ok(parse('x'.repeat(2049),origin)===null,'maximum input length');
ok(parse(good,'https://other.example')===null,'same-origin enforced');

// R268: canonical host can be opened from the public www alias without
// server redirects or converting the private fragment into a query string.
ok(parse(good,'https://www.dafamilialanches.com.br')===good,'www handoff to canonical apex');
ok(parse('https://www.dafamilialanches.com.br/acompanhar#t='+token,origin)===null,'reject www token as noncanonical');
ok(parse('https://www.dafamilialanches.com.br/acompanhar#t='+token,'https://www.dafamilialanches.com.br')===null,'reject www-only link even on www');
ok(parse(good,'https://evil.example')===null,'untrusted origin cannot use canonical exception');
ok(parse(origin+'/acompanhar?t='+token,'https://www.dafamilialanches.com.br')===null,'reject token in query string');

const cmp=fs.readFileSync('src/components/tracking/TrackingLinkEntry.tsx','utf8');
const orders=fs.readFileSync('src/components/ui/OrdersModal.tsx','utf8');
const route=fs.readFileSync('src/app/api/customer/tracking-capability/route.ts','utf8');
ok(orders.includes('<TrackingLinkEntry />'),'Meus pedidos handoff');
ok(cmp.includes('if (!available) return null'),'fail-closed gate');
ok(cmp.includes("cache: 'no-store'"),'no cache');
ok(!/localStorage|sessionStorage|navigator\.clipboard/.test(cmp.replace(/\/\/[^\n]*/g,'')),'no token persistence');
ok(!cmp.includes('console.'),'no token logging');
ok(route.includes('trackingEnabled()'),'server-side feature flag');
ok(route.includes('trackingNoStoreHeaders'),'no-store server');
ok(!route.includes('NEXT_PUBLIC_'),'no client flag');
const success=fs.readFileSync('src/components/ui/OrderSuccessModal.tsx','utf8');
ok(success.includes('openModal("orders")'),'checkout success unchanged');
console.log('R264_GATE_PASS: '+n+' safety and integration assertions');
