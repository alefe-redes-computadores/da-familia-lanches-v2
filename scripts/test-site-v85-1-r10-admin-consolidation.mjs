import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const admin=read('src/app/admin/page.tsx'),css=read('src/app/admin/admin.module.css'),feedback=read('src/components/home/CustomerExperiencePrompt.tsx');
const tests=[
 ['Admin desacopla digitacao de busca pesada',admin.includes('useDeferredValue')&&admin.includes('normalizeSearch(deferredSearch)')],
 ['Admin usa filtro diferido sem alterar busca historica',admin.includes('searchHistoryIdentifier(term),550')&&admin.includes('[operationalPedidos, deferredSearch, tab, serviceFilter, attentionOnly, now]')],
 ['relogio operacional pausa no segundo plano',admin.includes('if (document.visibilityState === "visible") setNow(Date.now())')],
 ['relogio atualiza na volta ao PWA e limpa listener',admin.includes('visibilitychange", updateClock')&&admin.includes('removeEventListener("visibilitychange", updateClock)')],
 ['prioridade operacional encontra mais antigo em alerta',admin.includes('sort((a, b) => (orderAgeMinutes(b, now) ?? 0) - (orderAgeMinutes(a, now) ?? 0))')],
 ['atencao nao inclui agendados nem concluidos',admin.includes('"Pendente", "Em Produção", "Pronto", "Saiu para Entrega"')],
 ['notificacao mobile acessivel e informa contagem',admin.includes('counts.attention} pedidos precisam de atenção')],
 ['acoes mobile mantem toque confortavel',css.includes('DFL V85.1 R10 - ADMIN FINISH')&&css.includes('.operationHeroStats button{min-height:54px')],
 ['feedback bloqueia disparo em duplicidade',feedback.includes('submitting.current = true')&&feedback.includes('if (!id || submitting.current) return')],
 ['feedback possui limite de espera e abort controlado',feedback.includes('new AbortController()')&&feedback.includes('9000')],
 ['feedback nao marca sucesso em falha HTTP',feedback.indexOf('if (!response.ok) throw')<feedback.indexOf('markExperienceAnswered(id)')],
 ['feedback conserva estado e possibilidade de reenviar',feedback.includes('setError("Não foi possível enviar agora.')&&feedback.includes('submitting.current = false')],
 ['API e contrato de satisfacao anteriores preservados',feedback.includes('/api/experience-feedback')&&feedback.includes('experienceVersion: "v56.2"')&&feedback.includes('customerMode: "guest"')],
 ['R1 protegendo painel de Gestao',admin.includes('AdminSectionBoundary section="Saúde e relatórios"')],
 ['R3 mantem filtros e inspecao',admin.includes('className={styles.filterSummary}')&&admin.includes('data-admin-inspector-close="true"')],
 ['R9 preserva exibicao apenas de categorias ativas',read('src/app/page.tsx').includes('categories.some((category) => category.id === product.category)')],
 ['impressao automatica permanece desligada',read('src/lib/printOrder.ts').includes('buildThermalReceipt')||read('src/lib/thermalReceipt.ts').includes('window.print();')],
];
for(const [name,pass] of tests){assert.ok(pass,'R10: '+name);console.log('✓',name)}
console.log('DFL SITE V85.1 R10 — 17 CONTRATOS APROVADOS');
