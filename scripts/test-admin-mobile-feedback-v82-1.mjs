import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const ok=(value,label)=>{if(!value)throw new Error('V82.1: '+label);console.log('OK:',label)};
const local=read('src/components/admin/StoreOperationAdmin.module.css');
const global=read('src/components/admin/ui/admin-foundation.css');
const screen=read('src/components/admin/StoreOperationAdmin.tsx');
ok(screen.includes('className={styles.msg}'),'feedback da operação localizado');
ok(local.includes('DFL V82.1 — feedback local móvel normalizado'),'correção local aplicada');
ok(local.includes('grid-template-columns: minmax(0, 1fr) 40px'),'fechar integrado ao cartão');
ok(local.includes('env(safe-area-inset-bottom'),'área segura inferior respeitada');
ok(local.includes('.msg > button')&&local.includes('position: static !important'),'botão não se desprende do toast');
ok(global.includes('DFL V82.1 — contrato móvel dos toasts globais'),'toast global reforçado');
ok(global.includes('grid-template-columns: 36px minmax(0, 1fr) 38px'),'layout global compacto');
ok(global.includes('overflow-wrap: anywhere'),'textos longos não vazam');
console.log('V82.1 TOASTS MÓVEIS: contratos aprovados.');
