/** R26 — server-only, bounded read-only snapshots for the Admin's DFL 360 center. */
import 'server-only';
import {adminDb} from '@/lib/integration/server/admin';
import {AUTO_ACCEPT_COLLECTION} from './automaticAcceptancePolicy';
import {R25_COLLECTION} from './automaticInitialPolicy';
import {R27_COLLECTION,r27DispatchConfigured} from './r27ProviderPolicy';
import {r26Flags,r26Summarize,r26Unavailable,R26_SAMPLE_LIMIT,type R26Lane,type R26LaneSummary} from './r26OperationalPolicy';

const sources:Record<R26Lane,string>={
  messages:'integration_notification_intents',
  acceptances:AUTO_ACCEPT_COLLECTION,
  tracking_links:R25_COLLECTION,
  automatic_delivery:R27_COLLECTION,
};
export async function r26ReadOperations(){
  const lanes: R26Lane[]=['messages','acceptances','tracking_links','automatic_delivery'];
  // One explicit Admin request = three small Firestore reads. No listeners, writes or cron.
  const snapshots=await Promise.allSettled(lanes.map(lane=>
    adminDb.collection(sources[lane]).orderBy('created_at','desc').limit(R26_SAMPLE_LIMIT).get(),
  ));
  const summary={} as Record<R26Lane,R26LaneSummary>;
  lanes.forEach((lane,index)=>{
    const outcome=snapshots[index];
    summary[lane]=outcome.status==='fulfilled'
      ? r26Summarize(lane,outcome.value.docs.map(doc=>doc.data()),R26_SAMPLE_LIMIT)
      : r26Unavailable();
  });
  const flags=r26Flags(process.env);
  return {
    ok:true as const, checkedAt:new Date().toISOString(),sampleLimit:R26_SAMPLE_LIMIT,
    degraded:lanes.some(lane=>!summary[lane].available),lanes:summary,flags,
    transportReady:r27DispatchConfigured(process.env),
    // Configured on Site != certified Entregas capability or provider delivery.
    certification:'requires_end_to_end_homologation' as const,
    providerDeliveryVerified:false as const,
    note:'Amostras limitadas do Firestore. Fila, ACK S2S e aceite pela API do provedor nao comprovam entrega ou leitura no WhatsApp.'
  };
}
