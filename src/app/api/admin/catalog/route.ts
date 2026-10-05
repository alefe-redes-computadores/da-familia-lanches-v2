import { NextRequest,NextResponse } from"next/server";
import { FieldValue } from"firebase-admin/firestore";
import { revalidateTag } from"next/cache";
import { adminAuth } from"@/lib/integration/server/adminAuth";
import { adminDb } from"@/lib/integration/server/admin";
import { isAdminEmail } from"@/lib/adminAuthorization";
import { CATALOG_PRODUCTS_COLLECTION,CATALOG_ADDONS_COLLECTION } from"@/lib/catalog";
import { CATALOG_CATEGORIES_COLLECTION } from"@/lib/catalogCategories";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const SNAPSHOT_COLLECTION="public_materialized",SNAPSHOT_DOCUMENT="catalog_v1";
const BACKUP_COLLECTION="catalog_backups";
type Raw=Record<string,unknown>;
const cleanString=(v:unknown,max=500)=>typeof v==="string"?v.trim().slice(0,max):"";
const validId=(v:string)=>/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(v);
const boolean=(v:unknown,fallback=false)=>typeof v==="boolean"?v:fallback;
const numericOrNull=(v:unknown)=>v==null?null:finite(v);
const finite=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;

async function authenticate(request:NextRequest){
 const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim()||"";
 if(!bearer)return null; const decoded=await adminAuth.verifyIdToken(bearer,true);
 return isAdminEmail(decoded.email)?decoded:null;
}
function product(data:Raw){
 const name=cleanString(data.name,120);
 const description=cleanString(data.description,1000);
 const image=cleanString(data.image,500);
 const category=cleanString(data.category,80);
 const price=finite(data.price);
 const oldPrice=numericOrNull(data.oldPrice);
 const sortOrder=numericOrNull(data.sortOrder);
 const upsellUnitPrice=numericOrNull(data.upsellUnitPrice);
 if(!name||!description||!image||!category||price==null||price<0)throw new Error("PRODUCT_INVALID");
 if(oldPrice!=null&&(oldPrice<0||oldPrice<=price))throw new Error("PROMOTION_INVALID");

 const addonIds=Array.isArray(data.addonIds)
  ? data.addonIds.map(v=>cleanString(v,100)).filter(Boolean).slice(0,100)
  : null;
 const detailsItems=Array.isArray(data.detailsItems)
  ? data.detailsItems.map(v=>cleanString(v,300)).filter(Boolean).slice(0,50)
  : [];
 const bundleItems=Array.isArray(data.bundleItems)
  ? data.bundleItems.slice(0,50).map(v=>{
      const x=(v&&typeof v==="object"?v:{}) as Raw;
      const note=cleanString(x.note,200);
      return {
       productId:cleanString(x.productId,100),
       quantity:Math.max(1,Math.min(99,Math.trunc(finite(x.quantity)??1))),
       ...(note?{note}:{})
      };
    }).filter(v=>v.productId)
  : [];

 return {
  name,description,image,category,price,
  oldPrice:oldPrice??FieldValue.delete(),
  disponivel:boolean(data.disponivel,true),
  isSuggestion:boolean(data.isSuggestion),
  promoPlacement:cleanString(data.promoPlacement,40)||"none",
  sortOrder:sortOrder??FieldValue.delete(),
  addonIds:addonIds??FieldValue.delete(),
  detailsTitle:cleanString(data.detailsTitle,200)||FieldValue.delete(),
  detailsItems,
  includedExtras:cleanString(data.includedExtras,500)||FieldValue.delete(),
  bundleItems:bundleItems.length?bundleItems:FieldValue.delete(),
  publicSlug:cleanString(data.publicSlug,100)||FieldValue.delete(),
  publicSection:cleanString(data.publicSection,100)||FieldValue.delete(),
  upsellProductId:cleanString(data.upsellProductId,100)||FieldValue.delete(),
  upsellUnitPrice:upsellUnitPrice??FieldValue.delete(),
  updatedAt:FieldValue.serverTimestamp()
 };
}
function addon(data:Raw){
 const name=cleanString(data.name,120),price=finite(data.price);
 if(!name||price==null||price<0)throw new Error("ADDON_INVALID");
 return {...data,name,price,updatedAt:FieldValue.serverTimestamp()};
}
async function invalidate(){
 await adminDb.collection(SNAPSHOT_COLLECTION).doc(SNAPSHOT_DOCUMENT).delete().catch(()=>undefined);
 revalidateTag("public-catalog","max");
}
export async function POST(request:NextRequest){
 try{
  const admin=await authenticate(request);
  if(!admin)return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401});
  const length=Number(request.headers.get("content-length")||0);
  if(length>256000)return NextResponse.json({ok:false,error:"PAYLOAD_TOO_LARGE"},{status:413});
  const body=await request.json() as Raw,action=cleanString(body.action,40),id=cleanString(body.id,100),data=(body.data&&typeof body.data==="object"?body.data:{}) as Raw;
  const products=adminDb.collection(CATALOG_PRODUCTS_COLLECTION),categories=adminDb.collection(CATALOG_CATEGORIES_COLLECTION),addons=adminDb.collection(CATALOG_ADDONS_COLLECTION);
  if(action==="saveProduct"||action==="toggleProduct"){if(!id||!validId(id))throw new Error("ID_REQUIRED");await products.doc(id).set(product(data),{merge:true});}
  else if(action==="saveCategory"||action==="toggleCategory"){if(!id||!validId(id))throw new Error("ID_REQUIRED");const label=cleanString(data.label,100);if(!label)throw new Error("CATEGORY_INVALID");await categories.doc(id).set({...data,id,label,updatedAt:FieldValue.serverTimestamp()},{merge:true});}
  else if(action==="deleteCategory"){if(!id||!validId(id))throw new Error("ID_REQUIRED");const used=await products.where("category","==",id).limit(1).get();if(!used.empty)throw new Error("CATEGORY_IN_USE");await categories.doc(id).delete();}
  else if(action==="saveAddon"||action==="toggleAddon"){if(!id||!validId(id))throw new Error("ID_REQUIRED");await addons.doc(id).set({...addon(data),id},{merge:true});}
  else if(action==="reorderCategories"||action==="reorderProducts"){
   const items=Array.isArray(body.items)?body.items as Array<Raw>:[]; if(!items.length||items.length>200)throw new Error("ORDER_INVALID");
   const col=action==="reorderCategories"?categories:products,batch=adminDb.batch();
   items.forEach(item=>{const itemId=cleanString(item.id,100),sortOrder=finite(item.sortOrder);if(!itemId||!validId(itemId)||sortOrder==null)throw new Error("ORDER_INVALID");batch.set(col.doc(itemId),{sortOrder,updatedAt:FieldValue.serverTimestamp()},{merge:true});});
   await batch.commit();
  }
  else if(action==="standardizeProducts"){
   const items=Array.isArray(body.items)?body.items as Array<Raw>:[]; if(!items.length||items.length>200)throw new Error("ORDER_INVALID");
   const ids=items.map(item=>cleanString(item.id,100));
   if(ids.some(itemId=>!itemId||!validId(itemId))||new Set(ids).size!==ids.length)throw new Error("ID_REQUIRED");
   const refs=ids.map(itemId=>products.doc(itemId));
   const current=await adminDb.getAll(...refs);
   if(current.some(snapshot=>!snapshot.exists))throw new Error("PRODUCT_NOT_FOUND");
   const backupRef=adminDb.collection(BACKUP_COLLECTION).doc();
   const batch=adminDb.batch();
   batch.set(backupRef,{action:"standardizeProducts",createdAt:FieldValue.serverTimestamp(),count:items.length,adminEmail:cleanString(admin.email,200)});
   current.forEach(snapshot=>batch.set(backupRef.collection("products").doc(snapshot.id),snapshot.data() as Raw));
   items.forEach((item,index)=>{
    const itemData=(item.data&&typeof item.data==="object"?item.data:{}) as Raw;
    batch.set(refs[index],product(itemData),{merge:true});
   });
   await batch.commit();
   await invalidate();
   return NextResponse.json({ok:true,backupId:backupRef.id},{headers:{"Cache-Control":"no-store"}});
  }
  else if(action==="restoreCatalogBackup"){
   const backupId=cleanString(body.backupId,100); if(!backupId||!validId(backupId))throw new Error("BACKUP_ID_REQUIRED");
   const backupRef=adminDb.collection(BACKUP_COLLECTION).doc(backupId);
   const meta=await backupRef.get();
   if(!meta.exists||meta.data()?.action!=="standardizeProducts")throw new Error("BACKUP_NOT_FOUND");
   const saved=await backupRef.collection("products").get();
   if(saved.empty||saved.size>200)throw new Error("BACKUP_INVALID");
   const batch=adminDb.batch();
   saved.docs.forEach(snapshot=>batch.set(products.doc(snapshot.id),snapshot.data(),{merge:false}));
   batch.set(backupRef,{restoredAt:FieldValue.serverTimestamp(),restoredBy:cleanString(admin.email,200)},{merge:true});
   await batch.commit();
   await invalidate();
   return NextResponse.json({ok:true,restoredCount:saved.size},{headers:{"Cache-Control":"no-store"}});
  } else return NextResponse.json({ok:false,error:"ACTION_INVALID"},{status:400});
  await invalidate();
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const code=error instanceof Error?error.message:"CATALOG_MUTATION_FAILED";
  console.error("[api/admin/catalog]",error);
  const client=new Set(["PRODUCT_INVALID","PROMOTION_INVALID","ADDON_INVALID","CATEGORY_INVALID","CATEGORY_IN_USE","ID_REQUIRED","ORDER_INVALID","PRODUCT_NOT_FOUND","BACKUP_ID_REQUIRED","BACKUP_NOT_FOUND","BACKUP_INVALID"]);
  return NextResponse.json({ok:false,error:client.has(code)?code:"CATALOG_MUTATION_FAILED"},{status:client.has(code)?400:500});
 }
}
