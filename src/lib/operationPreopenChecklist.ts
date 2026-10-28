/** R39: triagem somente de leitura. Não afirma que a loja está pronta só por ausência de alertas. */
export type ReadinessLevel = "ok" | "review" | "unknown";
export type ReadinessCheck = {id:string;title:string;level:ReadinessLevel;detail:string};
export type PreopenInput = {
  activeOrders:number;attentionOrders:number;outboxBacklog:number|null;
  quarantined:number|null;remoteError:boolean;remoteState:"healthy"|"attention"|"quarantine"|null;
};
export function inspectPreopenChecklist(v:PreopenInput):ReadinessCheck[] {
  return [
    {id:"queue",title:"Fila para a abertura",level:v.activeOrders>0?"review":"ok",detail:v.activeOrders>0?
      `${v.activeOrders} pedido(s) em etapas ativas. Confira antes de iniciar o turno.`:"Sem pedidos ativos entre os registros carregados."},
    {id:"attention",title:"Alertas locais",level:v.attentionOrders>0?"review":"ok",detail:v.attentionOrders>0?
      `${v.attentionOrders} pedido(s) precisam de atenção.`:"Nenhum alerta entre os pedidos carregados."},
    {id:"integration",title:"Site → Entregas",level:v.remoteError||v.remoteState===null?"unknown":v.remoteState==="healthy"?"ok":"review",detail:v.remoteError?
      "A última consulta falhou. Confira novamente a integração.":v.remoteState===null?
      "Use Verificar para consultar a integração; não presumimos que ela está saudável.":v.remoteState==="healthy"?
      "Integração sem alertas na última consulta realizada.":"Há atenção ou quarentena na integração; confira antes de abrir."},
    {id:"outbox",title:"Fila de eventos",level:v.outboxBacklog===null||v.quarantined===null||v.remoteError?"unknown":v.outboxBacklog+v.quarantined>0?"review":"ok",detail:
      v.outboxBacklog===null||v.quarantined===null||v.remoteError?"Pendente de uma consulta válida ao diagnóstico.":
      v.outboxBacklog+v.quarantined>0?`${v.outboxBacklog} pendente(s), ${v.quarantined} em quarentena.`:"Nenhum evento pendente ou em quarentena na última consulta."},
  ];
}
