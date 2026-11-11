'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, RefreshCw, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import type { AndroidFlavor, VerifiedAndroidRelease } from '@/lib/android-updates/policy';
import styles from './AndroidUpdatesCenter.module.css';
import { readReleaseAlertEnabled, writeReleaseAlertEnabled } from '@/lib/android-updates/alertPrefs';

type ResponsePayload = { ok: boolean; app?: string; available?: boolean; release?: VerifiedAndroidRelease | null; error?: string };
type Phase = 'loading' | 'ready' | 'error';
const RECHECK_INTERVAL_MS = 10 * 60 * 1000;

export function AndroidUpdatesCenter({ app }: { app: AndroidFlavor }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [release, setRelease] = useState<VerifiedAndroidRelease | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsMessage, setAlertsMessage] = useState('');
  const busy = useRef(false);
  const lastCheck = useRef(0);
  const alive = useRef(false);
  const admin = app === 'admin';
  const title = admin ? 'DFL Admin' : 'Da Família Lanches';

  const refresh = useCallback(async (force = false) => {
    if (busy.current || (!force && Date.now() - lastCheck.current < RECHECK_INTERVAL_MS)) return;
    busy.current = true;
    lastCheck.current = Date.now();
    if (alive.current) setPhase('loading');
    try {
      const response = await fetch(`/api/updates/android?app=${app}`, { cache: 'no-store' });
      const payload = await response.json() as ResponsePayload;
      if (!response.ok || payload.ok !== true || payload.app !== app || (payload.release && payload.release.app !== app)) throw Error('verification_failed');
      if (!alive.current) return;
      setRelease(payload.available === true ? payload.release || null : null);
      setPhase('ready');
      setCheckedAt(Date.now());
    } catch {
      if (!alive.current) return;
      setRelease(null);
      setPhase('error');
      // Falha e desconhecimento de versao nao ativam alertas.
      lastCheck.current = Date.now() - RECHECK_INTERVAL_MS + 90_000;
    } finally { busy.current = false; }
  }, [app]);

  useEffect(() => {
    alive.current = true;
    setOnline(navigator.onLine);
    setAlertsEnabled(readReleaseAlertEnabled(app));
    void refresh(true);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onOnline = () => { setOnline(true); void refresh(true); };
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh, app]);

  const changeAlertPreference = () => {
    try {
      const next = !alertsEnabled;
      writeReleaseAlertEnabled(app, next, phase === 'ready' ? release?.build || 0 : 0);
      setAlertsEnabled(next);
      setAlertsMessage(next ? 'Preferência salva. Só uma NOVA release certificada será anunciada ao abrir ou retornar ao app.' : 'Avisos locais de novas releases desativados.');
    } catch { setAlertsMessage('Não conseguimos salvar a preferência neste aparelho.'); }
  };
  const theme = admin ? styles.admin : styles.cliente;
  const date = checkedAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(checkedAt)) : null;
  return (
    <main className={`${styles.page} ${theme}`}>
      <div className={styles.shell}>
        <nav className={styles.top} aria-label="Navegação de atualizações">
          <Link href={admin ? '/admin' : '/'} className={styles.back}><ArrowLeft size={18}/> Voltar</Link>
          <span className={styles.appName}>{title}</span>
        </nav>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><Smartphone size={16}/> VERSÕES & SEGURANÇA</span>
          <h1>Atualizações</h1>
          <p>Confira apenas versões Android realmente produzidas e certificadas. A experiência do Site é atualizada pela web e não exige instalar um novo APK a cada publicação.</p>
        </header>
        <section className={styles.card} aria-live="polite">
          <div className={styles.cardHead}>
            <div><small>APK ANDROID</small><h2>Versão certificada</h2></div>
            <button type="button" onClick={() => void refresh(true)} disabled={phase === 'loading'} className={styles.refresh}>
              <RefreshCw size={16} className={phase === 'loading' ? styles.spin : ''}/>
              {phase === 'loading' ? 'Conferindo…' : 'Verificar'}
            </button>
          </div>
          {!online && <p className={styles.warning}><WifiOff size={16}/> Sem internet. Não é possível certificar uma versão nova agora.</p>}
          {phase === 'loading' ? <p className={styles.muted}>Consultando o GitHub Releases e a Action Android correspondente…</p> :
           phase === 'error' ? <p className={styles.warning}>Não conseguimos confirmar a versão. Nenhum APK será oferecido com uma verificação incompleta.</p> :
           release ? <>
             <div className={styles.version}><CheckCircle2 size={19}/><div><strong>APK verificado · build {release.build}</strong><span>Pacote: <code>{release.packageId}</code></span></div></div>
             <div className={styles.details}>
               <div><span>Associação à Action</span><strong>Concluída com sucesso</strong></div>
               <div><span>Arquivo</span><strong>{(release.bytes / 1048576).toFixed(1)} MB</strong></div>
               <div><span>SHA-256 publicado</span><code>{release.sha256}</code></div>
             </div>
             <a className={styles.cta} href={`intent://updates#Intent;scheme=dflupdate;package=${release.packageId};S.browser_fallback_url=${encodeURIComponent(release.pageUrl)};end`}><Download size={17}/> Atualizar no aplicativo Android</a>
             <a className={styles.nativeFallback} href={release.pageUrl} target="_blank" rel="noopener noreferrer">Abrir APK certificado no GitHub (alternativa manual)</a>
             <p className={styles.note}>No APK com R57 instalado, o primeiro botão abre a atualização nativa com versão instalada, MB, porcentagem, cancelamento, SHA-256 e assinatura verificada. No navegador ou em APKs antigos, use o link oficial. A primeira instalação do R57 ainda é manual.</p>
           </> : <div className={styles.empty}><ShieldCheck size={24}/><strong>Nenhum APK certificado disponível</strong><p>Sem uma Release pública correspondente a uma Action aprovada, não indicamos atualização. Um deploy do Site, sozinho, não é uma nova versão Android.</p></div>}
          {date && <p className={styles.timestamp}>Última verificação: {date}</p>}
        </section>
        <section className={styles.card} aria-label="Preferência de avisos de atualização">
          <div className={styles.cardHead}><div><small>PREFERÊNCIAS DESTE APARELHO</small><h2>Avisos de novas versões</h2></div></div>
          <label className={styles.releaseAlertChoice}><input type="checkbox" checked={alertsEnabled} onChange={changeAlertPreference}/><span><strong>Avisar quando sair um novo APK certificado</strong><small>Opt-in local. Ao abrir ou retornar ao Site, podemos mostrar um aviso discreto para uma release nova. Não solicita permissão Android, não ativa push nem roda em segundo plano. A comparação com o APK instalado é feita na tela nativa.</small></span></label>
          {alertsMessage && <p className={styles.muted} role="status">{alertsMessage}</p>}
        </section>
        <section className={styles.facts} aria-label="Como funcionam as atualizações">
          <div><ShieldCheck size={20}/><div><strong>Identidade preservada</strong><span>Admin e Cliente têm pacotes distintos; nunca misturamos os instaladores.</span></div></div>
          <div><RefreshCw size={20}/><div><strong>Reverificar ao voltar</strong><span>Consultamos ao abrir esta central e após retornar à tela, com intervalo controlado. Não há monitoramento permanente em segundo plano.</span></div></div>
          <div><Smartphone size={20}/><div><strong>Versão instalada</strong><span>A tela Android do atualizador consulta o versionCode real. No navegador e no PWA, não afirmamos que há atualização para seu aparelho.</span></div></div>
        </section>
      </div>
    </main>
  );
}
