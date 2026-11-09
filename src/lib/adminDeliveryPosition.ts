/** DFL SITE R36 — one physical-route position, never coerce null to zero.
 * The public and Admin displays are projections. Entregas remains the
 * authority for route start, physical grouping and transitions.
 */
export type AdminDeliveryPosition = {
  kind: 'completed' | 'next' | 'ahead' | 'waiting' | 'unavailable';
  label: string;
  verified: boolean;
  stopsAhead: number | null;
};
const positiveCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 100 ? value : null;
const pendingCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100 ? value : null;
const startedEvent = (event: unknown) =>
  event === 'delivery.out_for_delivery' || event === 'delivery.position_changed' || event === 'delivery.next_stop';

export function adminDeliveryPosition(order: Record<string, unknown>): AdminDeliveryPosition {
  if(order.deliveryOperationalCompleted === true || order.deliveryTrackingEvent === 'delivery.completed')
    return {kind:'completed',label:'Entrega concluída',verified:true,stopsAhead:null};
  const event = order.deliveryTrackingEvent;
  if(!startedEvent(event)) {
    return {kind:'waiting',label:'Rota vinculada · posição aguardando saída',verified:false,stopsAhead:null};
  }
  const ahead = pendingCount(order.deliveryStopsAhead);
  const total = positiveCount(order.deliveryTotalStops);
  const position = positiveCount(order.deliveryStopPosition);
  // A number is only useful while the route is active. A missing, contradictory
  // or out-of-bounds position MUST NOT look like a verified zero.
  if(ahead === null || total === null || ahead >= total || (position !== null && position > total)) {
    return {kind:'unavailable',label:'Posição da rota ainda não confirmada',verified:false,stopsAhead:null};
  }
  if(order.deliveryIsNextStop === true && ahead !== 0) {
    return {kind:'unavailable',label:'Posição da rota em atualização',verified:false,stopsAhead:null};
  }
  if(ahead === 0) return {kind:'next',label:'Próxima parada confirmada',verified:true,stopsAhead:0};
  return {kind:'ahead',label:ahead === 1 ? '1 parada física antes' : `${ahead} paradas físicas antes`,verified:true,stopsAhead:ahead};
}
