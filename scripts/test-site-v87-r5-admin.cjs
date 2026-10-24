const fs=require('node:fs');
const assert=require('node:assert/strict');
const file=(p)=>fs.readFileSync(p,'utf8');
const feedback=file('src/components/admin/CustomerExperienceAdmin.tsx');
const feedbackCss=file('src/components/admin/CustomerExperienceAdmin.module.css');
const quality=file('src/components/admin/CatalogQualityPanel.tsx');
const coupons=file('src/components/admin/CouponsAdmin.tsx');
const card=file('src/components/layout/OrderCard.tsx');
const tests=[
 ['Feedback exige token e API existentes',feedback.includes('user.getIdToken()')&&feedback.includes('fetch("/api/experience-feedback"')],
 ['Feedback mantém leitura sob demanda sem listener',!feedback.includes('onSnapshot')&&!feedback.includes('setInterval(')],
 ['Feedback limite 100 e valida IDs e ratings',feedback.includes('value.slice(0, 100)')&&feedback.includes('used.has(id)')&&feedback.includes('rating !== "melhorar"')],
 ['Feedback trata timeout e preserva amostra anterior',feedback.includes('AbortController')&&feedback.includes('10_000')&&feedback.includes('setError(')],
 ['Feedback separa avaliação positiva e negativa',feedback.includes('percentage')&&feedback.includes('view === "positive"')],
 ['Feedback acessível e responsivo',feedbackCss.includes(':focus-visible')&&feedbackCss.includes('@media(max-width:640px)')],
 ['Qualidade continua sem chamadas Firebase',!quality.includes('firebase/')&&!quality.includes('getDoc(')&&!quality.includes('onSnapshot')],
 ['Qualidade mantém contratos de conteúdo',quality.includes('Nome repetido na mesma categoria')&&quality.includes('Combo vinculado a item inexistente')],
 ['Qualidade filtra localmente e mostra tudo em páginas',quality.includes('const filtered=useMemo(')&&quality.includes('const visible=filtered.slice(0,pageSize)')&&quality.includes('setPageSize(current=>current+25)')],
 ['Cupons possuem filtro status sem consultas adicionais',coupons.includes('couponState(item,now)')&&coupons.includes('statusFilter')&&coupons.includes('aria-pressed={statusFilter === key}')],
 ['Cupons continuam com confirmação e gravação autoritativa',coupons.includes('await confirm(')&&coupons.includes('await setDoc(')&&coupons.includes('await deleteDoc(')],
 ['Pedido continua com cancelamento oficial',card.includes('confirmCancellation()')&&card.includes('ORDER_CANCELLATION_REASONS')],
 ['Diálogo de cancelamento responde a Escape e foca fechamento',card.includes('cancelCloseRef.current?.focus()')&&card.includes('event.key==="Escape"')&&card.includes('aria-pressed={cancelReasonCode === reason.code}')],
];
for(const [label,ok] of tests){assert.ok(ok,'R5: '+label);console.log('✓ '+label)}
console.log('V87 R5: '+tests.length+' contratos aprovados.');
