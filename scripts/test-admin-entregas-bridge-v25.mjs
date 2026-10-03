import fs from 'node:fs';
const r=p=>fs.readFileSync(p,'utf8'); const ok=(v,m)=>{if(!v)throw new Error('V25 SITE: '+m)};
const b=r('src/lib/adminDeliveryBridge.ts'), c=r('src/components/layout/OrderCard.tsx'), h=r('src/hooks/useAdminOrders.ts');
ok(b.includes('com.dfl.entregas'),'package'); ok(b.includes('dflentregas'),'scheme'); ok(b.includes('browser_fallback_url'),'fallback'); ok(c.includes('Abrir no Entregas'),'ação'); ok(c.includes('pedido.deliveryId'),'deliveryId'); ok((h.match(/onSnapshot\s*\(/g)||[]).length===1,'listener único');
console.log('V25 SITE OK — ADMIN → DFL ENTREGAS');
