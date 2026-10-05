"use client";
import { auth } from "@/lib/firebase";
import { patchPublicCatalogProduct, reloadPublicCatalog } from "@/lib/publicCatalogClient";

export type CatalogMutation =
 | { action:"saveProduct"; id:string; data:Record<string,unknown> }
 | { action:"toggleProduct"; id:string; data:Record<string,unknown> }
 | { action:"saveCategory"; id:string; data:Record<string,unknown> }
 | { action:"toggleCategory"; id:string; data:Record<string,unknown> }
 | { action:"deleteCategory"; id:string }
 | { action:"reorderCategories"; items:Array<{id:string;sortOrder:number}> }
 | { action:"saveAddon"; id:string; data:Record<string,unknown> }
 | { action:"toggleAddon"; id:string; data:Record<string,unknown> }
 | { action:"reorderProducts"; items:Array<{id:string;sortOrder:number}> }
 | { action:"standardizeProducts"; items:Array<{id:string;data:Record<string,unknown>}> };

const messages:Record<string,string>={
 ADMIN_AUTH_REQUIRED:"Sua sessão expirou. Entre novamente no Admin.",
 AUTH_REQUIRED:"Sua sessão expirou. Entre novamente no Admin.",
 PRODUCT_INVALID:"Revise nome, descrição, imagem, categoria e preço.",
 PROMOTION_INVALID:"O preço anterior precisa ser maior que o preço atual.",
 ADDON_INVALID:"Revise o nome e o preço do adicional.",
 CATEGORY_INVALID:"Informe um nome válido para a categoria.",
 CATEGORY_IN_USE:"Essa categoria ainda possui produtos. Mova-os antes de excluir.",
 ORDER_INVALID:"Não foi possível validar a nova ordem.",
 PAYLOAD_TOO_LARGE:"A alteração ficou grande demais. Reduza os dados e tente novamente.",
 CATALOG_MUTATION_FAILED:"Não foi possível salvar a alteração do catálogo."
};

export class CatalogMutationError extends Error{
 code:string;
 constructor(code:string){
  super(messages[code]||messages.CATALOG_MUTATION_FAILED);
  this.name="CatalogMutationError";
  this.code=code;
 }
}

export async function mutateCatalog(input:CatalogMutation){
 await auth.authStateReady();
 const user=auth.currentUser;
 if(!user)throw new CatalogMutationError("ADMIN_AUTH_REQUIRED");
 const token=await user.getIdToken();
 const response=await fetch("/api/admin/catalog",{
  method:"POST",
  headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
  body:JSON.stringify(input),
  cache:"no-store"
 });
 const payload=await response.json().catch(()=>null) as {ok?:boolean;error?:string}|null;
 if(!response.ok||!payload?.ok)throw new CatalogMutationError(payload?.error||"CATALOG_MUTATION_FAILED");
 if((input.action==="saveProduct"||input.action==="toggleProduct")&&patchPublicCatalogProduct(input.id,input.data))return payload;
 await reloadPublicCatalog();
 return payload;
}
