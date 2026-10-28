import { NextRequest, NextResponse } from "next/server";
import { inspectGeoapifyAddress, readPreviewInput, readRouteDistanceKm } from "@/lib/addressPreviewCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control":"no-store, private", "X-Content-Type-Options":"nosniff" };
const respond = (data: Record<string,unknown>, status=200) => NextResponse.json(data, {status,headers});
const buckets = new Map<string,{at:number,count:number}>();
const allowedCoord = (a:unknown, b:unknown) => {
  if (a === undefined || b === undefined || a === "" || b === "") return null;
  const lat=Number(a),lon=Number(b);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat>=-23 && lat<=-14 && lon>=-51 && lon<=-42 ? {lat,lon}:null;
};

/** Consulta sob demanda. Não grava endereço, não registra pedido, não calcula o preço do frete. */
export async function POST(request: NextRequest) {
  if (process.env.GEOAPIFY_ADDRESS_PREVIEW_ENABLED !== "true") return respond({ok:false,code:"DISABLED"},503);
  const key=process.env.GEOAPIFY_API_KEY;
  if (!key) return respond({ok:false,code:"UNAVAILABLE"},503);
  const origin=request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return respond({ok:false,code:"ORIGIN_DENIED"},403);
  if (Number(request.headers.get("content-length") || 0)>480) return respond({ok:false,code:"INVALID"},400);
  let body:unknown;
  try { const raw=await request.text();if(raw.length>480) throw new Error("oversized");body=JSON.parse(raw); }
  catch { return respond({ok:false,code:"INVALID"},400); }
  const input=readPreviewInput(body);
  if (!input) return respond({ok:false,code:"INVALID"},400);
  // Contenção best-effort por instância: habilitar WAF/limite de borda antes de ampla divulgação.
  const ip=request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now=Date.now();if(buckets.size>1500)buckets.clear();
  const previous=buckets.get(ip);
  const bucket=previous && now-previous.at<60000 ? previous : {at:now,count:0};
  bucket.count++;buckets.set(ip,bucket);
  if(bucket.count>6)return respond({ok:false,code:"RATE_LIMITED"},429);
  const url=new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text",`${input.street}, ${input.number}, ${input.district}, Patos de Minas, Minas Gerais, Brasil`);
  url.searchParams.set("filter","countrycode:br");
  url.searchParams.set("format","json");
  url.searchParams.set("limit","3");
  url.searchParams.set("lang","pt");
  url.searchParams.set("apiKey",key);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4200);
  let inspected:ReturnType<typeof inspectGeoapifyAddress>;
  try {
    const response=await fetch(url,{signal:controller.signal,cache:"no-store"});
    if(!response.ok)return respond({ok:false,code:response.status===429?"BUSY":"UNAVAILABLE"},503);
    inspected=inspectGeoapifyAddress(input,await response.json());
  }catch {return respond({ok:false,code:"UNAVAILABLE"},503);}
  finally{clearTimeout(timeout);}
  let distanceKm:number|null=null;
  const store=allowedCoord(process.env.DFL_STORE_LAT,process.env.DFL_STORE_LON);
  if(store && inspected.state==="confirmed" && inspected.point && process.env.GEOAPIFY_ROUTE_PREVIEW_ENABLED === "true") {
    const route=new URL("https://api.geoapify.com/v1/routing");
    route.searchParams.set("waypoints",`${store.lat},${store.lon}|${inspected.point.lat},${inspected.point.lon}`);
    route.searchParams.set("mode","drive");route.searchParams.set("units","metric");
    route.searchParams.set("format","json");route.searchParams.set("apiKey",key);
    const routeController=new AbortController();const routeTimeout=setTimeout(()=>routeController.abort(),3200);
    try {const response=await fetch(route,{signal:routeController.signal,cache:"no-store"});if(response.ok)distanceKm=readRouteDistanceKm(await response.json());}
    catch { /* A ausência de rota não impede o checkout. */ }
    finally{clearTimeout(routeTimeout);}
  }
  // Nunca retornar coordenadas ou chave privada. Distância apenas informativa.
  return respond({ok:true,state:inspected.state,message:inspected.message, ...(distanceKm!==null?{distanceKm}:{})});
}
