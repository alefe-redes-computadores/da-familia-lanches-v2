/** R58: preferencia local para AVISO INTERNO de nova release Android certificada.
 * Nunca ativa notificacoes do Android, FCM, push, WhatsApp ou email.
 * Nao infere a versao instalada na TWA/PWA: fala somente de NOVA RELEASE PUBLICADA.
 */
import type { AndroidFlavor, VerifiedAndroidRelease } from './policy';
const ENABLED = 'dfl-android-apk-release-alert-v58-';
const LAST = 'dfl-android-apk-announced-v58-';
export const UPDATE_ALERT_PREF_CHANGED = 'dfl:android-update-alert-preference';
export function readReleaseAlertEnabled(app: AndroidFlavor): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(ENABLED + app) === '1'; } catch { return false; }
}
export function readLastAnnouncedBuild(app: AndroidFlavor): number {
  if (typeof window === 'undefined') return 0;
  try {
    const n = Number(window.localStorage.getItem(LAST + app) || '0');
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}
export function rememberAnnouncedBuild(app: AndroidFlavor, build: number): void {
  if (typeof window === 'undefined' || !Number.isSafeInteger(build) || build <= 0) throw Error('build_invalid');
  window.localStorage.setItem(LAST + app, String(Math.max(build, readLastAnnouncedBuild(app))));
}
export function writeReleaseAlertEnabled(app: AndroidFlavor, enabled: boolean, currentVerifiedBuild = 0): void {
  if (typeof window === 'undefined') throw Error('storage_unavailable');
  // Ao ativar, a versao JA conhecida vira marco: avisar somente as proximas.
  if (enabled && currentVerifiedBuild > 0) rememberAnnouncedBuild(app, currentVerifiedBuild);
  window.localStorage.setItem(ENABLED + app, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent(UPDATE_ALERT_PREF_CHANGED, { detail: app }));
}
export function shouldAnnounceVerifiedRelease(app: AndroidFlavor, release: VerifiedAndroidRelease | null): boolean {
  return readReleaseAlertEnabled(app) && release !== null && release.app === app &&
    Number.isSafeInteger(release.build) && release.build > 0 &&
    release.build > readLastAnnouncedBuild(app) &&
    release.sha256.length === 64 && release.packageId === (app === 'admin' ? 'br.com.dafamilialanches.admin' : 'br.com.dafamilialanches.cliente');
}
