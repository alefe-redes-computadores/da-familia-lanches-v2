import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import { CATALOG_ADDONS_COLLECTION, CATALOG_PRODUCTS_COLLECTION } from "@/lib/catalog";
import { CATALOG_CATEGORIES_COLLECTION } from "@/lib/catalogCategories";
import { errorCode, finishRouteTrace, startRouteTrace } from "@/lib/server/observability";
export const runtime = "nodejs";
const readCatalog = unstable_cache(async () => {
  const trace=startRouteTrace("public.catalog.refresh");
  const [products, addons, categories] = await Promise.all([adminDb.collection(CATALOG_PRODUCTS_COLLECTION).get(), adminDb.collection(CATALOG_ADDONS_COLLECTION).get(), adminDb.collection(CATALOG_CATEGORIES_COLLECTION).get()]);
  finishRouteTrace(trace,"ok",{firestoreDocuments:products.size+addons.size+categories.size,products:products.size,addons:addons.size,categories:categories.size});
  return {
    products: products.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    })),
    addons: addons.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    })),
    categories: categories.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    })),
    generatedAt: new Date().toISOString(),
  };
}, ["public-catalog-v2"], { revalidate:300, tags:["public-catalog"] });
export async function GET(){const trace=startRouteTrace("public.catalog.request");try{const payload=await readCatalog();finishRouteTrace(trace,"ok",{cachePolicy:"300s"});return NextResponse.json(payload,{headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=600","x-dfl-trace-id":trace.id}})}catch(error){finishRouteTrace(trace,"error",{errorCode:errorCode(error)});return NextResponse.json({products:[],addons:[],categories:[],generatedAt:null,degraded:true},{status:503,headers:{"Cache-Control":"no-store","x-dfl-trace-id":trace.id}})}}
