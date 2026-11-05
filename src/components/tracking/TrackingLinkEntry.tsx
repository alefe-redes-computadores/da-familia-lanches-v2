'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, LockKeyhole } from 'lucide-react';
import { parseTrackingLink } from '@/lib/tracking/client-link';

/** Optional handoff for an already authorized, staff-issued link. No link creation or retention. */
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

  const open = () => {
    const target = parseTrackingLink(input, window.location.origin);
    if (!target) {
      setError('Confira o link completo recebido da equipe. Não use apenas o número do pedido.');
      return;
    }
    // No localStorage, sessionStorage, analytics, request body, or clipboard read.
    window.location.assign(target);
  };

  return <section aria-label="Acesso protegido ao pedido" style={{border:'1px solid rgba(212,175,87,.24)',borderRadius:14,padding:14,marginBottom:12,background:'rgba(212,175,87,.045)'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,fontSize:13}}><LockKeyhole size={17}/> Acompanhamento protegido</div>
    <p style={{fontSize:12,opacity:.8,marginTop:7,marginBottom:9}}>Se recebeu um link privado da equipe, você pode abrir o acompanhamento detalhado. Seus pedidos abaixo continuam disponíveis normalmente.</p>
    {!expanded ? <button type="button" onClick={() => setExpanded(true)} style={{fontSize:12,textDecoration:'underline',textUnderlineOffset:3}}>Já tenho um link protegido</button> :
      <div style={{display:'grid',gap:8}}>
        <label htmlFor="dfl-tracking-link" style={{fontSize:12}}>Cole o link completo recebido</label>
        <input id="dfl-tracking-link" type="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={input}
          onChange={event => {setInput(event.target.value);setError('')}} placeholder="https://…/acompanhar#t=…"
          style={{minWidth:0,width:'100%',background:'#141414',border:'1px solid #555',borderRadius:9,padding:10,color:'#fff',fontSize:12}}/>
        {error && <p role="alert" style={{color:'#f6ad8f',fontSize:12}}>{error}</p>}
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button type="button" onClick={open} style={{display:'inline-flex',alignItems:'center',gap:6,fontWeight:700,fontSize:12}}><ExternalLink size={15}/> Abrir acompanhamento</button>
          <button type="button" onClick={() => {setExpanded(false);setInput('');setError('')}} style={{fontSize:12,opacity:.75}}>Cancelar</button>
        </div>
      </div>}
  </section>;
}
