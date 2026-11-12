'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ChevronDown, Link2, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { parseTrackingLink } from '@/lib/tracking/client-link';
import styles from './TrackingLinkEntry.module.css';

/** Read-only entry for a previously authorized URL; never issues, stores or logs tokens. */
export function TrackingLinkEntry() {
  const [available, setAvailable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/customer/tracking-capability', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (!controller.signal.aborted && data && typeof data === 'object' &&
        (data as { enabled?: unknown }).enabled === true) setAvailable(true);
    }).catch(() => { /* Fail closed; existing Meus pedidos remains available. */ });
    return () => controller.abort();
  }, []);

  if (!available) return null;

  const open = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = parseTrackingLink(input, window.location.origin);
    if (!target) {
      setError('Cole o link privado completo recebido da loja. O número do pedido, sozinho, não libera o acesso.');
      return;
    }
    window.location.assign(target);
  };

  const collapse = () => { setExpanded(false); setInput(''); setError(''); };

  return (
    <section className={styles.panel} aria-label="Acesso protegido ao acompanhamento" data-expanded={expanded}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true"><LockKeyhole size={19} strokeWidth={1.9} /></span>
        <div className={styles.headCopy}>
          <span className={styles.kicker}><ShieldCheck size={13} /> ACESSO PRIVADO</span>
          <h2>Acompanhamento por link</h2>
          <p>Se recebeu um link exclusivo da loja, abra o painel detalhado do seu pedido.</p>
        </div>
      </div>
      {!expanded ? (
        <button type="button" className={styles.reveal} aria-expanded="false"
          onClick={() => setExpanded(true)}>
          <span><Link2 size={17} /> Tenho um link privado</span>
          <ChevronDown size={17} aria-hidden="true" />
        </button>
      ) : (
        <form id="dfl-tracking-link-panel" className={styles.form} onSubmit={open} noValidate>
          <div className={styles.formHead}>
            <strong>Abra seu link protegido</strong>
            <button type="button" className={styles.close} onClick={collapse} aria-label="Fechar campo do link"><X size={18}/></button>
          </div>
          <label htmlFor="dfl-tracking-link">Link completo do acompanhamento</label>
          <div className={styles.field}><Link2 size={17} aria-hidden="true" />
            <input id="dfl-tracking-link" type="url" inputMode="url" autoComplete="off"
              autoCapitalize="off" spellCheck={false} value={input} maxLength={2048}
              onChange={event => { setInput(event.target.value); setError(''); }}
              placeholder="https://dafamilialanches.com.br/acompanhar…" aria-invalid={Boolean(error)}
              aria-describedby="dfl-tracking-link-guidance" />
          </div>
          <p className={styles.guidance} id="dfl-tracking-link-guidance">Por segurança, não é possível acessar a rota somente com o número do pedido.</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={styles.open} disabled={!input.trim()}>
            Abrir acompanhamento <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </form>
      )}
      <p className={styles.footnote}>Sem link? Acompanhe as etapas disponíveis nos seus pedidos logo abaixo.</p>
    </section>
  );
}
