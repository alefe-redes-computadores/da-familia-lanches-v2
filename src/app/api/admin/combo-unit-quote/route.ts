/**
 * R248 - consulta ADMINISTRATIVA sob demanda. Recalcula com Firestore Admin +
 * fallback do servidor, nunca com preços/alterações enviados pelo navegador.
 * Não cria checkout, pedido, outbox, pagamento nem operação de cozinha.
 */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth} from '@/lib/integration/server/adminAuth';
import {adminDb} from '@/lib/integration/server/admin';
import {isAdminEmail} from '@/lib/adminAuthorization';
import {products as fallbackProducts,type Product} from '@/data/products';
import {ADDONS as fallbackAddons,type Addon} from '@/data/addons';
import {normalizeRemoteProductRecord,normalizeRemoteAddonRecord} from '@/lib/catalog';
import {evaluateServerComboQuote} from '@/lib/comboUnitServerQuote';
import {prepareComboOrderV3Candidate} from '@/lib/comboUnitOrderV3Candidate';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_BODY=200_000;
const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const headers={'Cache-Control':'private, no-store, max-age=0'};
const response=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers});
const record=(raw:unknown):raw is Record<string,unknown>=>Boolean(raw)&&typeof raw==='object'&&!Array.isArray(raw);

function normalizedProduct(id:string,document:Record<string,unknown>|null):Product{
  const fallback=fallbackProducts.find(item=>item.id===id);
  if(!document&&!fallback)throw Error('CATALOG_PRODUCT_MISSING');
  const merged={...(fallback??{}),...(document??{}),id} as Record<string,unknown>;
  const candidate=normalizeRemoteProductRecord(id,merged);
  if(!candidate||candidate.id!==id||candidate.disponivel===false)throw Error('CATALOG_PRODUCT_UNAVAILABLE');
  return candidate;
}
function normalizedAddon(id:string,document:Record<string,unknown>|null):Addon{
  const fallback=fallbackAddons.find(item=>item.id===id);
  if(!document&&!fallback)throw Error('CATALOG_ADDON_MISSING');
  const merged={...(fallback??{}),...(document??{}),id} as Record<string,unknown>;
  const candidate=normalizeRemoteAddonRecord(id,merged);
  if(!candidate||candidate.id!==id)throw Error('CATALOG_ADDON_INVALID');
  return candidate;
}
export async function POST(request:NextRequest){
  try{
    const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
    if(!bearer)return response('AUTH_REQUIRED',401);
    const verified=await adminAuth.verifyIdToken(bearer,true);
    if(!isAdminEmail(verified.email))return response('ADMIN_REQUIRED',403);
    const raw=await request.text();
    if(!raw||raw.length>MAX_BODY)return response('PAYLOAD_INVALID',413);
    const body:unknown=JSON.parse(raw);
    if(!record(body)||Object.keys(body).sort().join(',')!=='batch,comboId,schema'||body.schema!==1||
      typeof body.comboId!=='string'||!ID.test(body.comboId)||!record(body.batch))return response('REQUEST_INVALID',400);
    const comboId=body.comboId;
    // Leitura somente depois de autenticar: a loja nao paga leituras anonimas.
    const ownerDoc=await adminDb.collection('CatalogoProdutos').doc(comboId).get();
    const owner=normalizedProduct(comboId,ownerDoc.exists?(ownerDoc.data() as Record<string,unknown>):null);
    if(!owner.bundleItems?.length||owner.bundleItems.length>20)return response('COMPOSITION_INVALID',409);
    const componentIds=[...new Set(owner.bundleItems.map(item=>item.productId))];
    if(componentIds.some(id=>!ID.test(id)||id===comboId))return response('COMPOSITION_INVALID',409);
    const componentDocs=await Promise.all(componentIds.map(id=>adminDb.collection('CatalogoProdutos').doc(id).get()));
    const products=[owner,...componentIds.map((id,index)=>normalizedProduct(
      id,componentDocs[index].exists?(componentDocs[index].data() as Record<string,unknown>):null,
    ))];
    // Consulta do catálogo de adicionais somente na ação manual do Admin.
    // Respeita inclusões, preços, pausas e limites atuais do servidor.
    const addonsSnapshot=await adminDb.collection('CatalogoAdicionais').limit(250).get();
    if(addonsSnapshot.size>=250) return response('ADDON_CATALOG_TOO_LARGE',409);
    const byAddonId=new Map(fallbackAddons.map(a=>[a.id,a]));
    for(const doc of addonsSnapshot.docs){
      if(!ID.test(doc.id))throw Error('CATALOG_ADDON_INVALID');
      byAddonId.set(doc.id,normalizedAddon(doc.id,doc.data() as Record<string,unknown>));
    }
    const quote=evaluateServerComboQuote(comboId,body.batch,products,[...byAddonId.values()]);
    const releaseGate=prepareComboOrderV3Candidate(quote);
    return NextResponse.json({ok:true,quote,releaseGate},{headers});
  }catch(error){
    const code=error instanceof Error?error.message:'';
    if(/^(?:COMBO_|CATALOG_)/.test(code))return response('CATALOG_OR_COMBO_CHANGED',409);
    if(error instanceof SyntaxError)return response('REQUEST_INVALID',400);
    console.error('[combo-unit-quote] administrator review failed',code.slice(0,140));
    return response('QUOTE_UNAVAILABLE',503);
  }
}
