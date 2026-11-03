/** R245 — explicit ingredient-removal declarations for the OFF combo laboratory.
 * A list in detailsItems is used ONLY as a consistency check, never as automatic permission.
 * This module does not mutate any catalog, order, or Firestore data.
 */
import type {Product} from '@/data/products';
import type {ComboCatalogLabOptions, ExplicitRemoval} from './comboUnitCatalogDraft';

export const COMBO_UNIT_REMOVAL_RULES_ENABLED = false as const;
export const COMBO_UNIT_REMOVAL_RULES_SCHEMA = 1 as const;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const CONTROL=/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
function guard(ok:unknown,code:string):asserts ok {if(!ok)throw new Error(`COMBO_REMOVAL_${code}`);}
export type ComboRemovalDeclaration = Readonly<{
  productId:string;
  ingredients: readonly ExplicitRemoval[];
}>;
export type ComboRemovalRulesDraft = Readonly<{
  schema:1;status:'preview_only';liveCatalogMutation:false;
  removableByProductId: Readonly<Record<string,readonly ExplicitRemoval[]>>;
  declaredProductCount:number;declaredIngredientCount:number;
}>;
/** Never infer allowed removals from the ingredient listing; require each explicit rule,
 * and cross-check it with a standalone ingredient label in detailsItems. */
export function prepareComboRemovalRulesDraft(products:readonly Product[], declarations:readonly ComboRemovalDeclaration[]):ComboRemovalRulesDraft {
  guard(Array.isArray(products)&&Array.isArray(declarations)&&declarations.length<=20,'INPUT_INVALID');
  const index=new Map<string,Product>();
  for(const product of products){guard(Boolean(product)&&typeof product.id==='string'&&ID.test(product.id)&&!index.has(product.id),'PRODUCT_INVALID');index.set(product.id,product);}
  const byProduct:Record<string,readonly ExplicitRemoval[]>=Object.create(null);
  let count=0;
  for(const declaration of declarations){
    guard(Boolean(declaration)&&typeof declaration.productId==='string'&&ID.test(declaration.productId)&&!Object.hasOwn(byProduct,declaration.productId),'DECLARATION_INVALID');
    const product=index.get(declaration.productId);
    guard(Boolean(product)&&product!.disponivel!==false&&product!.category!=='bebidas'&&!product!.bundleItems?.length,'PRODUCT_INELIGIBLE');
    guard(Array.isArray(declaration.ingredients)&&declaration.ingredients.length<=20,'INGREDIENTS_INVALID');
    const names=new Set((product!.detailsItems??[]).filter((s):s is string=>typeof s==='string').map(normalize));
    const used=new Set<string>(), usedLabels=new Set<string>();
    const parsed:ExplicitRemoval[]=[];
    for(const raw of declaration.ingredients){
      guard(Boolean(raw)&&typeof raw.id==='string'&&ID.test(raw.id)&&typeof raw.label==='string'&&raw.label.trim().length>0&&raw.label.length<=100&&!CONTROL.test(raw.label),'INGREDIENT_INVALID');
      const label=raw.label.trim().replace(/\s+/g,' '), canon=normalize(label);
      guard(names.has(canon),'INGREDIENT_NOT_IN_STRUCTURED_DETAILS');
      guard(!used.has(raw.id)&&!usedLabels.has(canon),'INGREDIENT_DUPLICATED');
      used.add(raw.id);usedLabels.add(canon);parsed.push({id:raw.id,label});count++;
    }
    byProduct[declaration.productId]=parsed;
  }
  return {schema:1,status:'preview_only',liveCatalogMutation:false,removableByProductId:byProduct,declaredProductCount:declarations.length,declaredIngredientCount:count};
}
export function removalRulesAsCatalogLabOptions(draft:ComboRemovalRulesDraft):ComboCatalogLabOptions{
  guard(draft.schema===1&&draft.status==='preview_only'&&draft.liveCatalogMutation===false,'DRAFT_INVALID');
  guard(draft.declaredProductCount===Object.keys(draft.removableByProductId).length,'DRAFT_COUNT_INVALID');
  return {removableByProductId:draft.removableByProductId};
}
