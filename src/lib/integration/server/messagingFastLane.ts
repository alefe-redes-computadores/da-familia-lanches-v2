import "server-only";
import { claimMessagingProjectionByIntentId, settleMessagingProjections } from "./messagingProjection";

const text=(v:unknown)=>String(v??"").trim();

export async function drainMessagingIntentFastLane(intentId:string){
  const ingestUrl=text(process.env.DFL_MESSAGING_INGEST_URL);
  const ingestToken=text(process.env.DFL_MESSAGING_INGEST_TOKEN);
  const timeoutMs=Math.max(1500,Math.min(10000,Number(process.env.DFL_MESSAGING_FASTLANE_TIMEOUT_MS)||4500));
  if(!ingestUrl||!ingestToken) return {attempted:false,queued:false,reason:"fastlane_not_configured"};

  const claimed=await claimMessagingProjectionByIntentId(intentId);
  const event=claimed.events[0];
  if(!event) return {attempted:true,queued:false,reason:"intent_not_claimable"};

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  let ok=false, error="";
  try{
    const response=await fetch(ingestUrl,{
      method:"POST",
      headers:{"content-type":"application/json","x-dfl-messaging-token":ingestToken},
      body:JSON.stringify({
        source:event.source,source_event_id:event.source_event_id,event_type:event.event_type,
        order_id:event.order_id,customer_phone:event.customer_phone,
        customer_name:event.customer_name,payload:event.payload,
      }),
      cache:"no-store",signal:controller.signal,
    });
    const body=await response.json().catch(()=>({})) as {ok?:unknown;error?:unknown;message?:unknown};
    ok=response.ok&&body.ok===true;
    if(!ok) error=text(body.error)||text(body.message)||`http_${response.status}`;
  }catch(e){ error=e instanceof Error?e.message:"fastlane_ingest_failed"; }
  finally{ clearTimeout(timer); }

  await settleMessagingProjections(claimed.worker_id,[{intent_id:event.intent_id,ok,error}]);
  if(ok){
    const workerUrl=text(process.env.DFL_MESSAGING_WORKER_URL);
    const workerToken=text(process.env.DFL_MESSAGING_WORKER_TOKEN);
    if(workerUrl&&workerToken){
      const wakeController=new AbortController();
      const wakeTimer=setTimeout(()=>wakeController.abort(),timeoutMs);
      try{
        const wake=await fetch(workerUrl,{
          method:"POST",
          headers:{"content-type":"application/json","x-dfl-messaging-token":workerToken},
          body:JSON.stringify({source:"site_fastlane",limit:20}),
          cache:"no-store",
          signal:wakeController.signal,
        });
        if(!wake.ok) console.warn("[integration/messaging] ingest concluído; wake falhou",{status:wake.status});
      }catch(e){
        console.warn("[integration/messaging] ingest concluído; wake indisponível",{error:e instanceof Error?e.message:"worker_wake_failed"});
      }finally{ clearTimeout(wakeTimer); }
    }else{
      console.warn("[integration/messaging] ingest concluído; worker fast-lane não configurado");
    }
  }

  return ok?{attempted:true,queued:true}:{attempted:true,queued:false,reason:error||"fastlane_ingest_failed"};
}
