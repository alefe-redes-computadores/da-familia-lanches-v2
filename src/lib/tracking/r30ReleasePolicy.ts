/** R30 — safety proof for P9 certification; never authorizes provider dispatch. */
export type R30Check={id:string;label:string;state:'configured'|'off'|'unknown'};
export type R30Remote={state:'not_checked'|'reachable'|'authenticated'|'unauthorized'|'unavailable'|'invalid_reply';providerConfigured:boolean|null;deliveryEnabled:boolean|null};
export type R30ReleaseStatus='blocked'|'ready_for_isolated_canary'|'unsafe_remote_enabled';
export type R30ReleaseAssessment={
  status:R30ReleaseStatus;
  transportAuthenticated:boolean;providerConfigured:boolean;
  customerDeliveryVerified:false;siteDispatchAuthorized:false;
  remoteSendDisabled:boolean;siteWorkerDisabled:boolean;
  blockers:{code:string;label:string}[];
  nextAction:string;
};

/** Read-only assessment. Never trust enabled Site flags or provider ACK as delivery proof. */
export function r30AssessRelease(checks:R30Check[],remote:R30Remote):R30ReleaseAssessment {
  const states=new Map(checks.map(c=>[c.id,c.state]));
  const good=(id:string)=>states.get(id)==='configured';
  const off=(id:string)=>states.get(id)==='off';
  const authenticated=remote.state==='authenticated';
  const providerConfigured=authenticated&&remote.providerConfigured===true;
  const remoteSendDisabled=authenticated&&remote.deliveryEnabled===false;
  const siteWorkerDisabled=off('worker');
  const emergencyEngaged=off('kill');
  const blockers:{code:string;label:string}[]=[];
  if(!good('endpoint'))blockers.push({code:'site_endpoint',label:'Verificar ponte HTTPS e credenciais existentes do Site'});
  if(!authenticated)blockers.push({code:'s2s_auth',label:remote.state==='unauthorized'?'Corrigir autenticação S2S entre Site e Supabase':'Validar autenticação S2S no pré-voo'});
  if(authenticated&&!providerConfigured)blockers.push({code:'provider_env',label:'Conferir Evolution API no receptor Supabase'});
  if(!siteWorkerDisabled)blockers.push({code:'site_worker',label:'Manter worker automático OFF durante a homologação isolada'});
  if(!emergencyEngaged)blockers.push({code:'site_kill',label:'Manter o bloqueio de emergência do Site ativo durante os testes'});
  if(remote.deliveryEnabled===true)blockers.push({code:'receiver_active',label:'Desativar imediatamente envio no receptor até homologação'});
  // These proofs cannot be inferred from booleans or API ACKs.
  blockers.push({code:'entregas_p9',label:'Homologar capability e emissão única no Entregas'});
  blockers.push({code:'canary',label:'Conferir número canário autorizado e confirmação real da mensagem'});
  const status:R30ReleaseStatus=remote.deliveryEnabled===true?'unsafe_remote_enabled':
    good('endpoint')&&providerConfigured&&remoteSendDisabled&&siteWorkerDisabled&&emergencyEngaged
      ?'ready_for_isolated_canary':'blocked';
  const nextAction=remote.deliveryEnabled===true?'Desligar transporte no receptor antes de continuar.':
    status==='ready_for_isolated_canary'?'Próxima etapa: homologar Entregas e executar canário consentido, com disparo separado e auditado.':
    'Corrija primeiro os bloqueios de configuração. Não habilite disparos para clientes.';
  return {status,transportAuthenticated:authenticated,providerConfigured,customerDeliveryVerified:false,
    siteDispatchAuthorized:false,remoteSendDisabled,siteWorkerDisabled,blockers,nextAction};
}
