/** Regras canônicas V86 R5 — cliente, Admin e API compartilham a mesma validação.
 * Sem grupos configurados, preserva integralmente o contrato V86 R4.
 * Cada adicional pode integrar NO MÁXIMO UM grupo, evitando cobrança ambígua.
 */
import { addonPolicy, validAddonSelection } from "@/lib/catalogAddonPolicy";
export type AddonChoiceGroup={ id:string; title:string; min:number; max:number; addonIds:string[] };
export type GroupedProduct={
  addonGroups?:AddonChoiceGroup[];
  minAddonSelections?:number;
  maxAddonSelections?:number;
};
export type GroupCheck={valid:boolean;reason:string;groups:AddonChoiceGroup[]};
const idPattern=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export function parseAddonGroups(value:unknown):GroupCheck{
  if(value==null)return {valid:true,reason:"",groups:[]};
  if(!Array.isArray(value)||value.length>8)return {valid:false,reason:"Máximo de oito grupos por produto.",groups:[]};
  const usedIds=new Set<string>(),usedOptions=new Set<string>();
  const parsed:AddonChoiceGroup[]=[];
  for(const raw of value){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return {valid:false,reason:"Grupo incompleto.",groups:[]};
    const r=raw as Record<string,unknown>;
    const id=typeof r.id==="string"?r.id.trim():"";
    const title=typeof r.title==="string"?r.title.trim():"";
    const min=r.min,max=r.max;
    if(!idPattern.test(id)||usedIds.has(id)||!title||title.length>70)
      return {valid:false,reason:"Nome ou identificador do grupo inválido ou duplicado.",groups:[]};
    if(!Array.isArray(r.addonIds)||!r.addonIds.length||r.addonIds.length>20)
      return {valid:false,reason:`${title}: selecione ao menos um adicional válido.`,groups:[]};
    if(typeof min!=="number"||typeof max!=="number"||!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<1||min>max||max>r.addonIds.length)
      return {valid:false,reason:`${title}: mínimo/máximo incompatível com as opções.`,groups:[]};
    const addonIds:string[]=[];
    for(const rawOption of r.addonIds){
      if(typeof rawOption!=="string"||!idPattern.test(rawOption)||usedOptions.has(rawOption))
        return {valid:false,reason:`${title}: adicional inválido ou repetido entre grupos.`,groups:[]};
      usedOptions.add(rawOption);addonIds.push(rawOption);
    }
    usedIds.add(id);parsed.push({id,title,min:min as number,max:max as number,addonIds});
  }
  return {valid:true,reason:"",groups:parsed};
}
export function productGroupConfiguration(product:GroupedProduct):GroupCheck{
  const groups=parseAddonGroups(product.addonGroups);
  if(!groups.valid)return groups;
  const p=addonPolicy(product);
  if(!p.valid)return {valid:false,reason:"Limites gerais dos adicionais inválidos.",groups:groups.groups};
  const required=groups.groups.reduce((sum,g)=>sum+g.min,0);
  if(required>p.max)return {valid:false,reason:"Soma das escolhas obrigatórias excede o limite geral.",groups:groups.groups};
  const capacities=groups.groups.reduce((sum,g)=>sum+g.max,0);
  // Limite geral pode incluir adicionais opcionais sem grupo; não exige max global <= capacidades.
  if(required>20||capacities>80)return {valid:false,reason:"Configuração excede limites operacionais.",groups:groups.groups};
  return groups;
}
export function inspectProductSelections(product:GroupedProduct,selectedIds:readonly string[]):GroupCheck{
  const config=productGroupConfiguration(product);
  if(!config.valid)return config;
  if(new Set(selectedIds).size!==selectedIds.length)return {valid:false,reason:"Não repita o mesmo adicional.",groups:config.groups};
  if(!validAddonSelection(product,selectedIds.length))return {valid:false,reason:"Revise a quantidade total de adicionais.",groups:config.groups};
  for(const group of config.groups){
    const count=selectedIds.filter(id=>group.addonIds.includes(id)).length;
    if(count<group.min)return {valid:false,reason:`${group.title}: escolha pelo menos ${group.min}.`,groups:config.groups};
    if(count>group.max)return {valid:false,reason:`${group.title}: máximo de ${group.max}.`,groups:config.groups};
  }
  return {valid:true,reason:"",groups:config.groups};
}
