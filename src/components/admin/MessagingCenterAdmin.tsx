'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LockKeyhole, MessageSquareText, RefreshCw, Search, ShieldCheck, ChevronDown, Layers3, ListFilter, Store, Truck, Settings2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import styles from './MessagingCenterAdmin.module.css';
import { AdminChoiceSelect } from './ui/AdminChoiceSelect';
import { Dfl360OperationsCard } from './Dfl360OperationsCard';
import { R32ReadyAuditCard } from './R32ReadyAuditCard';

type MessageStatus = 'pending' | 'processing' | 'queued' | 'failed' | 'suppressed' | 'unknown';
type MessageRow = {
  id: string;
  orderId: string;
  orderLabel: string;
  customerName: string;
  phoneMasked: string;
  event: string;
  source: 'site' | 'entregas';
  status: MessageStatus;
  eligible: boolean;
  attempts: number;
  createdAt: string | null;
  updatedAt: string | null;
  reason: string | null;
  errorClass: string | null;
  retry: { category: string; explanation: string; retryable: boolean;
    remaining: number; waitUntil: string | null; reason: string };
};
type ResponseData = {
  ok: boolean;
  rows: MessageRow[];
  checkedAt: string;
  truncated: boolean;
  limit: number;
  manualBridgeEnabled: boolean;
  retryConfigured: boolean;
  retryEnabled: boolean;
  retryLimit: number;
  note: string;
};
type Readiness = {
  ok: boolean;
  checkedAt: string;
  sample: number;
  sampleLimit: number;
  truncated: boolean;
  gates: { manualInboundEnabled: boolean; ingestConfigured: boolean; workerConfigured: boolean; siteToEntregasRelayEnabled: boolean };
  summary: Record<'site' | 'entregas' | 'unknown', Record<'pending' | 'processing' | 'queued' | 'failed' | 'suppressed' | 'other', number>>;
  latest: Record<'site' | 'entregas' | 'unknown', string | null>;
  note: string;
};
const statusLabels: Record<MessageStatus, string> = {
  pending: 'Aguardando', processing: 'Processando', queued: 'Na fila',
  failed: 'Falhou', suppressed: 'Suprimida', unknown: 'A verificar',
};
const eventLabels: Record<string, string> = {
  'order.created': 'Pedido recebido', 'order.production': 'Em produção',
  'order.ready': 'Pronto', 'order.cancelled': 'Cancelamento',
  'delivery.started': 'Saiu para entrega', 'delivery.next_stop': 'Próxima parada',
  'delivery.completed': 'Entrega concluída', 'delivery.failed': 'Problema na entrega',
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const niceDate = (value: string | null) => {
  if (!value) return 'Data indisponível';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data indisponível';
};

export function MessagingCenterAdmin() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<MessageStatus | 'all'>('all');
  const [source, setSource] = useState<'all' | 'site' | 'entregas'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bridge, setBridge] = useState<Readiness | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeError, setBridgeError] = useState('');
  const [confirmRetry, setConfirmRetry] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState('');
  const [view, setView] = useState<'orders' | 'messages'>('orders');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const consult = async () => {
    if (busy) return;
    setBusy(true); setError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 11000);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Faça login no Admin novamente.');
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/messaging', {
        method: 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null) as ResponseData | null;
      if (!response.ok || !result?.ok || !Array.isArray(result.rows)) throw new Error('Não foi possível consultar agora. Tente novamente.');
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'AbortError'
        ? 'Consulta demorou demais. Seus dados anteriores foram preservados.'
        : cause instanceof Error ? cause.message : 'Falha na consulta.');
    } finally { window.clearTimeout(timer); setBusy(false); }
  };

  const retryOne = async (id: string) => {
    if (retryBusy || !data?.retryEnabled) return;
    setRetryBusy(id); setRetryMessage(''); setConfirmRetry(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sua sessão expirou. Faça login novamente.');
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/messaging/retry', {
        method:'POST', cache:'no-store', credentials:'omit', signal:controller.signal,
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({action:'retry',id}),
      });
      const value = await response.json().catch(() => null) as
        {ok?:boolean;error?:string;remaining?:number;queuedInSupabase?:boolean;note?:string}|null;
      if (!response.ok || !value?.ok) {
        const reasons:Record<string,string> = {
          MANUAL_RETRY_OFF:'Tentativas desativadas pela configuração do servidor.',
          PERMANENT:'Falha impeditiva: corrija a origem antes de tentar.',
          LIMIT_REACHED:'Limite de duas tentativas manuais atingido.',
          COOLDOWN:'Aguarde o intervalo entre tentativas.',
          TOO_OLD:'Evento antigo. Reenvio bloqueado por segurança.',
          ORDER_CANCELLED:'Pedido cancelado: o aviso não pode ser reenviado.',
          OBSOLETE_STAGE:'Esta etapa já ficou para trás no pedido.',
          IN_PROGRESS:'Já existe processamento em andamento.',
          STATUS_CHANGED:'O status atual já mudou; confira o pedido.',
        };
        throw new Error(reasons[value?.error||'']||'Reenvio bloqueado. Atualize o diagnóstico.');
      }
      setRetryMessage(value.queuedInSupabase
        ? 'Nova tentativa aceita na fila. Isso não confirma recebimento no WhatsApp.'
        : 'Tentativa registrada. O servidor verificará a fila; não clique de novo.');
      await consult();
    } catch (cause) {
      setRetryMessage(cause instanceof Error && cause.name==='AbortError'
        ? 'Tempo esgotado. O pedido pode ter sido registrado: atualize antes de clicar novamente.'
        : cause instanceof Error ? cause.message : 'Falha ao solicitar tentativa.');
    } finally { window.clearTimeout(timer); setRetryBusy(null); }
  };

  const inspectBridges = async () => {
    if (bridgeBusy) return;
    setBridgeBusy(true); setBridgeError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 11000);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sessão administrativa indisponível.');
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/messaging-readiness', {
        method: 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null) as Readiness | null;
      if (!response.ok || !result?.ok || !result.summary) throw new Error('Diagnóstico indisponível.');
      setBridge(result);
    } catch (cause) {
      setBridgeError(cause instanceof Error && cause.name === 'AbortError'
        ? 'Tempo esgotado; dados anteriores preservados.'
        : cause instanceof Error ? cause.message : 'Falha no diagnóstico.');
    } finally { window.clearTimeout(timer); setBridgeBusy(false); }
  };

  const rows = useMemo(() => (data?.rows || []).filter(row => {
    if (status !== 'all' && row.status !== status) return false;
    if (source !== 'all' && row.source !== source) return false;
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    const corpus = normalize(`${row.orderId} ${row.orderLabel} ${row.customerName} ${row.event} ${eventLabels[row.event] || ''} ${row.phoneMasked}`);
    return terms.every(term => corpus.includes(term));
  }), [data, query, status, source]);
  const metrics = useMemo(() => {
    const all = data?.rows || [];
    return { pending: all.filter(r => r.status === 'pending' || r.status === 'processing').length,
      queued: all.filter(r => r.status === 'queued').length,
      failed: all.filter(r => r.status === 'failed').length,
      suppressed: all.filter(r => r.status === 'suppressed').length };
  }, [data]);

  const orders = useMemo(() => {
    // Agrupa somente a amostra recebida do servidor. Nenhuma nova leitura,
    // sincronizacao, listener ou alteracao do status comercial.
    const result = new Map<string, {id:string;label:string;name:string;items:MessageRow[];failed:number;updated:number;source:string}>();
    for(const row of rows){
      const id=row.orderId || row.id;
      const timestamp=Date.parse(row.updatedAt || row.createdAt || '') || 0;
      const previous=result.get(id) || {id,label:row.orderLabel,name:row.customerName,items:[],failed:0,updated:timestamp,source:row.source};
      previous.items.push(row);
      previous.failed += row.status==='failed' ? 1 : 0;
      previous.updated=Math.max(previous.updated,timestamp);
      if(timestamp>=previous.updated){previous.name=row.customerName;previous.source=row.source;}
      result.set(id,previous);
    }
    return [...result.values()].sort((a,b)=>b.updated-a.updated).map(group=>({
      ...group,items:group.items.sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||'')),
    }));
  },[rows]);

  return <section className={styles.root} aria-label="Central de mensageria">
    <div className={styles.hero}>
      <div className={styles.heroHead}>
        <span className={styles.eyebrow}><MessageSquareText size={15}/> OPERAÇÃO · DFL 360</span>
        <span className={styles.heroSeal}><ShieldCheck size={14}/> Acesso administrativo</span>
      </div>
      <h3>Central de Mensageria</h3>
      <p className={styles.heroLead}>Pedidos e avisos em um único lugar. Encontre uma falha, acompanhe a fila e confira a etapa do cliente sem perder tempo em relatórios técnicos.</p>
      <div className={styles.heroActions}>
        <button type="button" disabled={busy} onClick={() => void consult()}><RefreshCw size={16} aria-hidden="true"/>{busy ? 'Consultando…' : data ? 'Atualizar mensagens' : 'Consultar mensagens'}</button>
        <span className={styles.safety}><LockKeyhole size={14}/> {data?.retryEnabled ? 'Retry sob autorização' : 'Reenvio protegido'}</span>
      </div>
      {data && <small className={styles.checked} role="status">Última consulta: {niceDate(data.checkedAt)} · {data.rows.length} intenções na amostra</small>}
      {error && <p className={styles.error} role="alert"><AlertCircle size={16}/>{error}</p>}
      {retryMessage && <p className={styles.retryFeedback} role="status" aria-live="polite">{retryMessage}</p>}
    </div>

    <div className={styles.metrics} aria-label="Resumo das últimas intenções consultadas">
      <div><Clock3 size={18}/><strong>{data ? metrics.pending : '—'}</strong><small>Aguardando</small></div>
      <div><MessageSquareText size={18}/><strong>{data ? metrics.queued : '—'}</strong><small>Na fila</small></div>
      <div><AlertCircle size={18}/><strong>{data ? metrics.failed : '—'}</strong><small>Falhas</small></div>
      <div><ShieldCheck size={18}/><strong>{data ? metrics.suppressed : '—'}</strong><small>Suprimidas</small></div>
    </div>

    <details className={styles.advanced}>
      <summary><span><Settings2 size={17}/> Ferramentas avançadas</span><span>Diagnóstico técnico <ChevronDown size={16}/></span></summary>
      <div className={styles.advancedBody}>
        <p>Os testes de assinatura e os bloqueios de integração ficam aqui, fora da operação diária. Não há envio ao clicar em diagnosticar.</p>
        <Dfl360OperationsCard />
        <R32ReadyAuditCard />
        <div className={styles.advancedControls}>
          <button type="button" disabled={bridgeBusy} onClick={() => void inspectBridges()}><ShieldCheck size={16} aria-hidden="true"/>{bridgeBusy ? 'Analisando…' : 'Diagnosticar pontes'}</button>
          <span>Mensageria manual: {data?.manualBridgeEnabled ? 'habilitada pelo servidor' : 'desativada'}.</span>
        </div>
        {bridgeError && <p className={styles.error} role="alert"><AlertCircle size={16}/>{bridgeError}</p>}
        {bridge && <div className={styles.notice} role="status" aria-live="polite">
          <ShieldCheck size={17} aria-hidden="true" />
          <p><strong>Diagnóstico das pontes · somente leitura</strong>
            <span style={{display:'block',marginTop:6}}>Site → fila: {bridge.gates.ingestConfigured ? 'configurada' : 'pendente'} · worker: {bridge.gates.workerConfigured ? 'configurado' : 'pendente'} · Site → Entregas: {bridge.gates.siteToEntregasRelayEnabled ? 'habilitado' : 'OFF'} · avisos manuais: {bridge.gates.manualInboundEnabled ? 'habilitados' : 'OFF'}.</span>
            <span style={{display:'block',marginTop:6}}>Últimas {bridge.sample} intenções: Site {Object.values(bridge.summary.site).reduce((a,b)=>a+b,0)}, Entregas {Object.values(bridge.summary.entregas).reduce((a,b)=>a+b,0)}. Último evento logístico: {niceDate(bridge.latest.entregas)}.</span>
            <small style={{display:'block',marginTop:6}}>Amostra limitada a {bridge.sampleLimit} registros; não confirma entrega no WhatsApp nem estado do provedor.</small>
          </p>
        </div>}
      </div>
    </details>

    <div className={styles.notice}><ShieldCheck size={18} aria-hidden="true"/><p><strong>Fila não é confirmação de entrega.</strong> “Na fila” significa que a integração aceitou a intenção. Não informa se o WhatsApp recebeu, leu ou entregou a mensagem. Não se repete uma mensagem já aceita pelo provedor sem conciliar o histórico real.</p></div>
    <div className={styles.retryNotice}><LockKeyhole size={16}/><span>MSG-M5 · até 2 tentativas manuais, 1 processamento por toque, com intervalo de segurança. Falhas definitivas e mensagens já enfileiradas não podem ser reexecutadas. {data?.retryEnabled ? 'Reenvio controlado autorizado.' : 'Reenvio manual OFF até homologação.'}</span></div>

    {data && <>
      <div className={styles.filters}>
        <label className={styles.search}><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pedido, nome ou final do telefone" aria-label="Pesquisar intenções" /></label>
        <div><AdminChoiceSelect label="Status" value={status} onChange={(next:MessageStatus | 'all')=>setStatus(next)} options={[
          {value:'all',label:'Todos os estados'},...(Object.keys(statusLabels) as MessageStatus[]).map(key=>({value:key,label:statusLabels[key]}))
        ]}/></div>
        <div><AdminChoiceSelect label="Origem" value={source} onChange={(next:'all' | 'site' | 'entregas')=>setSource(next)} options={[
          {value:'all',label:'Ambas as origens'},{value:'site',label:'Site'},{value:'entregas',label:'Entregas'}
        ]}/></div>
      </div>
      <p className={styles.results} role="status">{rows.length} de {data.rows.length} registros exibidos {data.truncated ? `· limite de ${data.limit}; não é o histórico completo` : ''}</p>
      <div className={styles.viewTabs} role="group" aria-label="Modo de visualização">
        <button type="button" aria-pressed={view==='orders'} className={view==='orders'?styles.activeTab:undefined} onClick={()=>setView('orders')}><Layers3 size={16}/> Por pedido <span>{orders.length}</span></button>
        <button type="button" aria-pressed={view==='messages'} className={view==='messages'?styles.activeTab:undefined} onClick={()=>setView('messages')}><ListFilter size={16}/> Mensagens <span>{rows.length}</span></button>
      </div>
      {view==='orders' ? <div className={styles.orderList}>
        {orders.length===0 && <div className={styles.empty}>Nenhum pedido encontrado com esses filtros.</div>}
        {orders.map(group=><article className={styles.orderCard} key={group.id}>
          <button type="button" className={styles.orderTrigger} aria-expanded={expandedOrder===group.id} onClick={()=>setExpandedOrder(expandedOrder===group.id?null:group.id)}>
            <span className={styles.orderIcon}>{group.source==='site'?<Store size={19}/>:<Truck size={19}/>}</span>
            <span className={styles.orderIdentity}>
              <strong>{group.name}</strong>
              <small>{group.label} · {group.items.length} atualizaç{group.items.length===1?'ão':'ões'}</small>
            </span>
            <span className={group.failed?styles.orderProblem:group.items[0].status==='queued'?styles.orderHealthy:styles.orderNeutral}>{group.failed?`${group.failed} falha${group.failed===1?'':'s'}`:statusLabels[group.items[0].status]}</span>
            <ChevronDown className={expandedOrder===group.id?styles.rotated:undefined} size={17}/>
          </button>
          {expandedOrder===group.id&&<div className={styles.orderDetails}>
            <div className={styles.orderTimelineLabel}>Histórico na amostra · não é rastreamento da entrega</div>
            {group.items.map(item=><div key={item.id} className={styles.timelineItem} data-state={item.status}>
              <div className={styles.timelineRow}><strong>{eventLabels[item.event]||item.event}</strong><span>{statusLabels[item.status]}</span></div>
              <small>{niceDate(item.createdAt)} · {item.source==='site'?'Site':'Entregas'} · {item.phoneMasked}</small>
              {item.status==='failed'&&<p className={styles.timelineFailure}><AlertCircle size={14}/>{item.retry.explanation} {item.retry.retryable?'Abra “Mensagens” para uma tentativa autorizada.':'Reenvio bloqueado.'}</p>}
            </div>)}
            <p className={styles.orderFootnote}>Para editar ou mudar etapas do pedido, use o gerenciamento oficial no Admin. Esta central gerencia apenas notificações.</p>
          </div>}
        </article>)}
      </div> : <div className={styles.list}>

        {rows.length === 0 && <div className={styles.empty}>Nenhuma intenção corresponde aos filtros atuais.</div>}
        {rows.map(item => <article key={item.id} className={styles.item} data-state={item.status}>
          <div className={styles.itemTop}><div><span className={styles.origin}>{item.source === 'site' ? 'SITE' : 'ENTREGAS'}</span><strong>{eventLabels[item.event] || item.event}</strong></div><span className={styles.state}>{statusLabels[item.status]}</span></div>
          <div className={styles.person}><strong>{item.customerName}</strong><span>{item.orderLabel} · {item.phoneMasked}</span></div>
          <div className={styles.meta}><span>{niceDate(item.createdAt)}</span><span>{item.attempts} tentativa(s)</span>{item.errorClass && <span className={styles.warning}>Falha: {item.errorClass.replace(/_/g, ' ')}</span>}{item.reason && <span className={styles.warning}>Motivo: {item.reason.replace(/_/g, ' ')}</span>}</div>
          {item.status === 'failed' && <div className={styles.retryCard}>
            <div className={styles.retryCause}>
              <AlertCircle size={16}/><span><strong>Motivo: {item.retry.explanation}</strong>
              <small>{item.retry.reason === 'limit_reached' ? 'Limite manual atingido. Requer revisão.'
                : item.retry.reason === 'cooldown' ? `Aguarde até ${niceDate(item.retry.waitUntil)}.`
                : item.retry.reason === 'too_old' ? 'Evento antigo demais para repetir com segurança.'
                : item.retry.reason === 'permanent' ? 'Falha impeditiva; repetir não resolverá.'
                : `Restam ${item.retry.remaining} tentativas manuais (independentes das automáticas).`}</small></span>
            </div>
            {item.retry.retryable && data.retryEnabled && <div className={styles.retryActions}>
              {confirmRetry === item.id ? <>
                <span>Confirmar nova tentativa única para este pedido?</span>
                <button type="button" disabled={Boolean(retryBusy)} onClick={() => void retryOne(item.id)}>Confirmar</button>
                <button type="button" disabled={Boolean(retryBusy)} onClick={() => setConfirmRetry(null)}>Cancelar</button>
              </> : <button type="button" disabled={Boolean(retryBusy)} onClick={() => {setConfirmRetry(item.id); setRetryMessage('');}}><RefreshCw size={14}/> {retryBusy === item.id ? 'Tentando…' : 'Tentar novamente'}</button>}
            </div>}
            {!data.retryEnabled && <small>Reenvio desativado no servidor até a homologação autorizada.</small>}
          </div>}
          {item.status === 'queued' && <small className={styles.queuedDisclaimer}><CheckCircle2 size={13}/> Aceita na fila — entrega ao cliente não verificada; reenvio bloqueado.</small>}
        </article>)}
      </div>}
    </>}
    {!data && !busy && <div className={styles.empty}>Nenhum dado carregado. Toque em “Consultar mensagens” para ler os registros sob demanda.</div>}
  </section>;
}
