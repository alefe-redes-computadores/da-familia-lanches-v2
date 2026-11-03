/**
 * DFL SITE R246 — explicit removable ingredients in the commercial catalog.
 * A description is never permission to remove an ingredient. Only an admin-selected,
 * server-validated subset may appear in the OFF combo laboratory.
 * No price change, cart write, payment or Firestore access here.
 */
export type CatalogRemovableIngredient = Readonly<{id:string;label:string}>;
export const CATALOG_REMOVAL_POLICY_VERSION=1 as const;
const MAX_DETAILS=50,MAX_CHOICES=20;
const CONTROL=/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const ID=/^[a-z][a-z0-9-]{0,79}$/;
function fail(reason:string):never{throw new Error(`REMOVABLE_${reason}`);}
const canon=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
/** Stable IDs are derived from a *standalone* ingredient line, not a sentence. */
export function ingredientIdFromLabel(value:string):string{
 if(typeof value!=='string'||!value.trim()||value.length>100||CONTROL.test(value)||/[<>]/.test(value))fail('DETAIL_INVALID');
 const id=canon(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(!ID.test(id))fail('DETAIL_ID_INVALID');
 return id;
}
/** Shows available candidates only; it does NOT authorize any removal. */
export function removableIngredientCandidates(details:readonly string[]|undefined):readonly CatalogRemovableIngredient[]{
 if(details==null)return [];
 if(!Array.isArray(details)||details.length>MAX_DETAILS)fail('DETAIL_LIST_INVALID');
 const choices:CatalogRemovableIngredient[]=[];
 const ids=new Set<string>();
 for(const detail of details){
  const id=ingredientIdFromLabel(detail);
  if(ids.has(id))fail('DETAIL_DUPLICATE_OR_AMBIGUOUS');
  ids.add(id);choices.push({id,label:detail.trim().replace(/\s+/g,' ')});
 }
 return choices;
}
/** Fail-closed policy validation, shared between admin UI, backend and read-only catalog. */
export function parseCatalogRemovableIngredients(
 raw:unknown,details:readonly string[]|undefined,category:string,bundleItems:unknown,
):CatalogRemovableIngredient[]{
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>MAX_CHOICES)fail('POLICY_INVALID');
 if(raw.length&& (category==='bebidas'||(Array.isArray(bundleItems)&&bundleItems.length>0)))fail('PRODUCT_INELIGIBLE');
 if(!raw.length)return [];
 const candidates=removableIngredientCandidates(details);
 const byId=new Map(candidates.map(item=>[item.id,item]));
 const used=new Set<string>();
 for(const input of raw){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('ENTRY_INVALID');
  const item=input as Record<string,unknown>;
  if(typeof item.id!=='string'||!ID.test(item.id)||typeof item.label!=='string'||
     !item.label.trim()||item.label.length>100||CONTROL.test(item.label))fail('ENTRY_INVALID');
  if(used.has(item.id))fail('DUPLICATE');
  const match=byId.get(item.id);
  if(!match||canon(match.label)!==canon(item.label))fail('NOT_IN_STRUCTURED_DETAILS');
  used.add(item.id);
 }
 // Canonical order and labels always come from the product's structured details.
 return candidates.filter(item=>used.has(item.id));
}
/** Never turn invalid or stale remote policy into a permission. */
export function safeRemoteRemovableIngredients(
 raw:unknown,details:readonly string[]|undefined,category:string,bundleItems:unknown,
):CatalogRemovableIngredient[]{
 try{return parseCatalogRemovableIngredients(raw,details,category,bundleItems);}
 catch{return [];}
}
