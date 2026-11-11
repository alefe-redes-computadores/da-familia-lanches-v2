'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';
import type { AndroidFlavor, VerifiedAndroidRelease } from '@/lib/android-updates/policy';
import {
  readReleaseAlertEnabled, rememberAnnouncedBuild,
  shouldAnnounceVerifiedRelease, UPDATE_ALERT_PREF_CHANGED,
} from '@/lib/android-updates/alertPrefs';
import styles from './AndroidUpdateNotice.module.css';

type ResponsePayload = { ok?: boolean; app?: string; available?: boolean; release?: VerifiedAndroidRelease | null };
const CHECK_MS = 20 * 60 * 1000;
/** Um unico observador local, sem push remoto nem monitoramento Android em segundo plano. */
export function AndroidUpdateNotice({ app }: { app: AndroidFlavor }) {
  const [build, setBuild] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const checkedAt = useRef(0);
  const busy = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    setMounted(true);
    const check = async (force = false) => {
      if (!readReleaseAlertEnabled(app) || busy.current || !navigator.onLine ||
          (!force && Date.now() - checkedAt.current < CHECK_MS)) return;
      busy.current = true;
      checkedAt.current = Date.now();
      try {
        const response = await fetch(`/api/updates/android?app=${app}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as ResponsePayload;
        const release = data.available === true ? data.release || null : null;
        if (!alive.current || data.ok !== true || data.app !== app ||
            !shouldAnnounceVerifiedRelease(app, release)) return;
        // Antes de exibir, gravar dedupe. Falha de armazenamento nao gera aviso repetitivo.
        rememberAnnouncedBuild(app, release!.build);
        setBuild(release!.build);
      } catch { /* Falha nao gera falso aviso. */ }
      finally { busy.current = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const onPref = () => { setBuild(null); checkedAt.current = 0; void check(true); };
    void check(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener(UPDATE_ALERT_PREF_CHANGED, onPref);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener(UPDATE_ALERT_PREF_CHANGED, onPref);
    };
  }, [app]);
  if (!mounted || build === null) return null;
  return createPortal(<aside className={styles.notice} data-app={app} role="status" aria-label="Nova versão Android certificada">
    <BellRing aria-hidden="true" size={19}/>
    <div><strong>Novo APK certificado · versão {build}</strong><span>Confira se é mais recente que o instalado.</span>
      <Link href={app === 'admin' ? '/admin/atualizacoes' : '/atualizacoes'} onClick={() => setBuild(null)}>Ver atualizações</Link></div>
    <button type="button" onClick={() => setBuild(null)} aria-label="Dispensar aviso desta versão"><X size={18}/></button>
  </aside>, document.body);
}
