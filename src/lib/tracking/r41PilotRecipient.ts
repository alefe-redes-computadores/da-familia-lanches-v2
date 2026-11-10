/** R41: limite isolado do piloto P9. Somente um E164 brasileiro no backend.
 * Nunca inferir elegibilidade de consentimento, URL, email ou origem.
 * As politicas comerciais e de tracking continuam independentes.
 */
export function r41TrackingPilotRecipient(
  env: Record<string,string|undefined>, phone:unknown
): boolean {
  const expected=(env.DFL_SITE_TRACKING_AUTO_PILOT_PHONE_E164||'').trim();
  return /^\+55[1-9][0-9][2-9][0-9]{7,8}$/.test(expected) &&
    typeof phone==='string' && phone===expected;
}
