/** R244 — bridge between a supplied catalog snapshot and the OFF combo laboratory.
 * Data here is NOT server authority, a live quote or a permission to sell.
 * No Firebase, requests, storage or mutations.
 */
import type { Product } from "@/data/products";
import type { Addon } from "@/data/addons";
import { availableAddonsForProduct } from "@/lib/catalog";
import { productGroupConfiguration } from "@/lib/catalogModifierGroups";
import { buildComboBlueprint, type ComboBlueprint, type ComboUnitCapabilities } from "./comboUnitPlan";
import type { ComboUnitCommercialDraft } from "./comboUnitCommercial";

export const COMBO_UNIT_CATALOG_LAB_ENABLED = false as const;
export const COMBO_UNIT_CATALOG_LAB_SCHEMA = 1 as const;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const MAX_COMPONENTS=20;
const MAX_ADDONS=20;
const MAX_CENTS=5_000_000;
const validId=(id:unknown):id is string=>typeof id==="string"&&ID.test(id);
function guard(condition:unknown,code:string):asserts condition {if(!condition)throw new Error(`COMBO_CATALOG_${code}`);}
function cents(value:unknown,code:string,max=MAX_CENTS){
  guard(typeof value==="number"&&Number.isFinite(value)&&value>=0,code);
  const scaled=value*100, rounded=Math.round(scaled);
  guard(Number.isSafeInteger(rounded)&&rounded<=max&&Math.abs(scaled-rounded)<0.000001,code);
  return rounded;
}
export type ExplicitRemoval=Readonly<{id:string;label:string}>;
export type ComboCatalogLabOptions=Readonly<{
  /** Explicit authoring input for the lab. Never infer removable ingredients from text. */
  removableByProductId?: Readonly<Record<string,readonly ExplicitRemoval[]>>;
}>;
export type ComboCatalogLab=Readonly<{
  schema:1; status:"preview_only"; payable:false; catalogAuthority:false;
  blueprint:ComboBlueprint;
  capabilities:ComboUnitCapabilities;
  policy:ComboUnitCommercialDraft;
  labels:Readonly<{
    products:Readonly<Record<string,string>>;
    addons:Readonly<Record<string,string>>;
    ingredients:Readonly<Record<string,string>>;
  }>;
  includedProducts:readonly string[];
  additionPricesCents:Readonly<Record<string,number>>;
}>;
/** Strict adapter: validates catalog entries, stock flags, groups and exact cent values.
 * Even a 'hybrid' public catalog snapshot is never a trusted checkout price.
 */
export function prepareComboCatalogLab(
  comboId:string, products:readonly Product[], addons:readonly Addon[], options:ComboCatalogLabOptions={},
):ComboCatalogLab {
  guard(validId(comboId)&&Array.isArray(products)&&Array.isArray(addons),"INPUT_INVALID");
  const productIndex=new Map<string,Product>(), addonIndex=new Map<string,Addon>();
  for(const product of products){
    guard(product&&validId(product.id)&&!productIndex.has(product.id),"PRODUCT_DUPLICATE_OR_INVALID");
    productIndex.set(product.id,product);
  }
  for(const addon of addons){
    guard(addon&&validId(addon.id)&&!addonIndex.has(addon.id),"ADDON_DUPLICATE_OR_INVALID");
    addonIndex.set(addon.id,addon);
  }
  const owner=productIndex.get(comboId);
  guard(owner&&owner.disponivel!==false,"COMBO_NOT_AVAILABLE");
  guard(Array.isArray(owner.bundleItems)&&owner.bundleItems.length>0&&owner.bundleItems.length<=MAX_COMPONENTS,"COMPOSITION_REQUIRED");
  const basePrice=cents(owner.price,"COMBO_PRICE_INVALID");
  const blueprint=buildComboBlueprint(owner.id,owner.bundleItems);
  const productsInCombo=[...new Set(blueprint.units.map(unit=>unit.productId))];
  const addonIdsByProduct:Record<string,readonly string[]>=Object.create(null);
  const removableIdsByProduct:Record<string,readonly string[]>=Object.create(null);
  const productsLabels:Record<string,string>=Object.create(null);
  const addonsLabels:Record<string,string>=Object.create(null);
  const ingredientLabels:Record<string,string>=Object.create(null);
  const rulesByProductId:Record<string,ComboUnitCommercialDraft["rulesByProductId"][string]>=Object.create(null);
  const additionPricesCents:Record<string,number>=Object.create(null);
  for(const id of productsInCombo){
    const product=productIndex.get(id);
    guard(product&&product.disponivel!==false&&!product.bundleItems?.length,"COMPONENT_UNAVAILABLE_OR_NESTED");
    guard(typeof product.name==="string"&&product.name.trim().length>0&&product.name.length<=100,"COMPONENT_NAME_INVALID");
    const optionsForProduct=availableAddonsForProduct(product,[...addonIndex.values()]);
    guard(optionsForProduct.length<=MAX_ADDONS,"TOO_MANY_ADDONS");
    const groupConfig=productGroupConfiguration(product);
    guard(groupConfig.valid,"ADDON_GROUP_CONFIGURATION_INVALID");
    const allowed=optionsForProduct.map(a=>a.id);
    // No mandatory group may reference an unavailable or forbidden addon.
    for(const group of groupConfig.groups){
      guard(group.addonIds.every(addonId=>allowed.includes(addonId)),"GROUP_HAS_UNAVAILABLE_ADDON");
    }
    const priceTable:Record<string,number>=Object.create(null);
    for(const addon of optionsForProduct){
      guard(typeof addon.name==="string"&&addon.name.trim().length>0&&addon.name.length<=100,"ADDON_NAME_INVALID");
      const price=cents(addon.price,"ADDON_PRICE_INVALID",1_000_000);
      priceTable[addon.id]=price;additionPricesCents[addon.id]=price;addonsLabels[addon.id]=addon.name.trim();
    }
    const removals=options.removableByProductId?.[id]??[];
    guard(Array.isArray(removals)&&removals.length<=MAX_ADDONS,"REMOVALS_INVALID");
    const removedIds:string[]=[];
    for(const removal of removals){
      guard(removal&&validId(removal.id)&&!removedIds.includes(removal.id)&&
        typeof removal.label==="string"&&removal.label.trim().length>0&&removal.label.length<=100,"REMOVAL_INVALID");
      removedIds.push(removal.id);ingredientLabels[removal.id]=removal.label.trim();
    }
    // The actual v1 product config remains authority for legacy sales; this is only a draft translation.
    const min=product.minAddonSelections??0;
    const max=product.maxAddonSelections??20;
    guard(Number.isInteger(min)&&Number.isInteger(max)&&min>=0&&max>=min&&max<=20,"ADDON_LIMIT_INVALID");
    guard(min<=allowed.length,"MANDATORY_ADDON_UNAVAILABLE");
    addonIdsByProduct[id]=allowed;
    removableIdsByProduct[id]=removedIds;
    productsLabels[id]=product.name.trim();
    rulesByProductId[id]={
      allowedAddonIds:allowed,removableIngredientIds:removedIds,addonPriceCents:priceTable,
      minAddonsPerUnit:min,maxAddonsPerUnit:Math.min(max,allowed.length),
      maxRemovalsPerUnit:removedIds.length,
      groups:groupConfig.groups.map(g=>({id:g.id,min:g.min,max:g.max,addonIds:[...g.addonIds]})),
    };
  }
  // Forbid unmatched removal declarations; otherwise a wrong product could hide policy mistakes.
  if(options.removableByProductId){
    guard(Object.keys(options.removableByProductId).every(id=>productsInCombo.includes(id)),"FOREIGN_REMOVAL_POLICY");
  }
  return {
    schema:1,status:"preview_only",payable:false,catalogAuthority:false,blueprint,
    capabilities:{addonIdsByProduct,removableIdsByProduct},
    policy:{version:1,status:"draft",billing:"per_selected_unit",removalDiscount:"none",
      productId:owner.id,blueprintFingerprint:blueprint.fingerprint,baseComboPriceCents:basePrice,rulesByProductId},
    labels:{products:productsLabels,addons:addonsLabels,ingredients:ingredientLabels},
    includedProducts:productsInCombo,additionPricesCents,
  };
}
