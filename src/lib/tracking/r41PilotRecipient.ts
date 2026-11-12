/** R62: dois escopos explicitos. OFF/invalidos falham fechados.
 * O consentimento por pedido, aceite confirmado, origem Site e horario de
 * ativacao continuam obrigatorios nas politicas R21/R25/R27 anteriores.
 */
export function r41TrackingPilotRecipient(
  env: Record<string,string|undefined>, phone:unknown
): boolean {
  if (typeof phone !== 'string' || !/^\+55[1-9][0-9][2-9][0-9]{7,8}$/.test(phone)) return false;
  const scope=(env.DFL_SITE_TRACKING_AUTO_SCOPE||'canary').trim();
  if (scope === 'consented_customers') {
    return env.DFL_SITE_TRACKING_AUTO_ROLLOUT_APPROVED === 'true';
  }
  if (scope !== 'canary') return false;
  const expected=(env.DFL_SITE_TRACKING_AUTO_PILOT_PHONE_E164||'').trim();
  return /^\+55[1-9][0-9][2-9][0-9]{7,8}$/.test(expected) && phone===expected;
}
