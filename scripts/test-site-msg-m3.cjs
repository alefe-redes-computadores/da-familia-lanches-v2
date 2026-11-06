#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let passed = 0;
const read = p => fs.readFileSync(p,'utf8');
function ok(value, name) { assert.ok(value,`MSG-M3: ${name}`); passed++; console.log('✓',name); }
const route = read('src/app/api/admin/messaging/route.ts');
const component = read('src/components/admin/MessagingCenterAdmin.tsx');
const css = read('src/components/admin/MessagingCenterAdmin.module.css');
const page = read('src/app/admin/page.tsx');
const quick = read('src/components/admin/AdminQuickSwitcher.tsx');
for (const [path, kind] of [
  ['src/app/api/admin/messaging/route.ts',ts.ScriptKind.TS],
  ['src/components/admin/MessagingCenterAdmin.tsx',ts.ScriptKind.TSX],
  ['src/app/admin/page.tsx',ts.ScriptKind.TSX],
  ['src/components/admin/AdminQuickSwitcher.tsx',ts.ScriptKind.TSX],
]) {
  const tree = ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,kind);
  ok(tree.parseDiagnostics.length===0,'TS/TSX parse: '+path);
}
ok(/verifyIdToken\(token, true\)/.test(route),'Auth verifica token revogado');
ok(route.includes('isAdminEmail(decoded.email)'),'Admin autorizado no servidor');
ok(route.includes('if (!token)') && route.includes('401'),'Endpoint exige Bearer');
ok(route.includes("403") && route.includes("FORBIDDEN"),'Nao-admin negado');
ok(route.includes('orderBy(\'created_at\', \'desc\').limit(MAX_ROWS)'),'Consulta recente limitada');
ok(route.includes('MAX_ROWS = 80'),'Limite 80 registros');
ok(!/\.onSnapshot\s*\(|setInterval\s*\(|\.on\s*\(/.test(route),'Sem listeners ou polling');
ok(!/\.set\s*\(|\.update\s*\(|\.create\s*\(|\.delete\s*\(|runTransaction\s*\(/.test(route),'API somente leitura sem escritas');
ok(/maskPhone\(data.customer_phone\)/.test(route),'Telefone mascarado no servidor');
ok(!/phone:\s*data\.customer_phone|customer_phone:\s*data\.customer_phone/.test(route),'Telefone cru nao retorna');
ok(!/payload:\s*data\.payload|last_error:\s*data\.last_error|token:\s*process.env/.test(route),'Nao retorna payload de pedido, erro bruto nem token');
ok(route.includes('errorClass(data.last_error)'),'Falha categorizada sem dados sensiveis');
ok(route.includes("'private, no-store, max-age=0'"),'Sem cache de dados privados');
ok(route.includes('manualBridgeEnabled: process.env.DFL_MANUAL_MESSAGING_ENABLED'),'Feature flag so de leitura');
ok(!/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/.test(route),'Sem endpoints de envio/retry');
ok(component.includes("onClick={() => void consult()}"),'Consulta so por clique');
ok(!/useEffect\s*\(|setInterval\s*\(|onSnapshot\s*\(/.test(component),'Frontend sem polling ou listeners');
ok(component.includes("getIdToken()") && component.includes('Bearer ${token}'),'API com token atual de sessao');
ok(component.includes('AbortController') && component.includes('11000'),'Timeout de 11 segundos');
ok(component.includes("setData(result)") && !component.includes('setData(null)'),'Falha preserva amostra anterior');
ok(component.includes('Fila não é confirmação de entrega.'),'Nao confunde fila e entrega real');
ok(component.includes("data.truncated") && component.includes('data.limit'),'UI esclarece amostra limitada');
ok(component.includes('role="alert"') && component.includes('role="status"'),'Avisos acessiveis');
ok(component.includes('type="search"') && component.includes('select value={status}') && component.includes('select value={source}'),'Filtros locais de pesquisa, status e origem');
ok(css.includes('@media(max-width:700px)') && css.includes('prefers-reduced-motion'),'Mobile e movimento reduzido');
ok(page.includes('const MessagingCenterAdmin = dynamic('),'Tela dinamica integrada');
ok(page.includes('tab === "mensageria"') && page.includes('Mensageria'),'Navegacao mobile e desktop');
ok(quick.includes('id:"mensageria"') && quick.includes('target:"mensageria"'),'Atalho busca global integrado');
ok(!route.includes('sendMessage') && !component.includes("fetch('/api/integration") && component.includes("fetch('/api/admin/messaging/retry'"),'MSG-M5: reenvio apenas pelo servidor autenticado; nenhum provedor no cliente');
console.log(`MSG-M3 CENTRAL: ${passed} contratos locais aprovados; sem Firestore real e sem WhatsApp.`);
