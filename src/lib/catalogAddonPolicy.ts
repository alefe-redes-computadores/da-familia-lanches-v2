/** V86 R4 — contrato de seleções válido no cliente e no servidor.
 * Não altera produtos legados: sem campos configurados, admite 0..20 adicionais.
 */
export type AddonPolicyFields={minAddonSelections?:number;maxAddonSelections?:number};
export type AddonPolicy={min:number;max:number;valid:boolean};
export function addonPolicy(input:AddonPolicyFields | null | undefined):AddonPolicy {
 const rawMin=input?.minAddonSelections;
 const rawMax=input?.maxAddonSelections;
 const min=rawMin==null?0:Number(rawMin);
 const max=rawMax==null?20:Number(rawMax);
 const valid=Number.isInteger(min)&&Number.isInteger(max)&&min>=0&&max>=0&&min<=max&&max<=20;
 return valid?{min,max,valid:true}:{min:0,max:20,valid:false};
}
export function validAddonSelection(product:AddonPolicyFields | null | undefined,count:number):boolean {
 const p=addonPolicy(product);
 return p.valid&&Number.isInteger(count)&&count>=p.min&&count<=p.max;
}
export function addonPolicyHint(product:AddonPolicyFields|null|undefined):string {
 const p=addonPolicy(product);
 if(!p.valid)return "Configuração de adicionais inválida";
 if(p.max===0)return "Este item não aceita adicionais";
 if(p.min>0&&p.min===p.max)return `Escolha exatamente ${p.min} adicional(is)`;
 if(p.min>0)return `Escolha pelo menos ${p.min} e no máximo ${p.max} adicional(is)`;
 if(p.max<20)return `Até ${p.max} adicional(is)`;
 return "Adicionais opcionais";
}
