"use client";
/** R248: botão administrativo manual para conferir preço com o servidor. */
import {useEffect,useRef,useState} from 'react';
import {auth} from '@/lib/firebase';
import type {ComboBatchDraft} from '@/lib/comboUnitBatchDraft';
import type {ComboServerQuote} from '@/lib/comboUnitServerQuote';
import type {ComboOrderV3Candidate} from '@/lib/comboUnitOrderV3Candidate';
import {ComboUnitV3AcceptancePanel} from './ComboUnitV3AcceptancePanel';
import styles from './ComboUnitServerQuotePanel.module.css';

type Props=Readonly<{
  comboId:string;batch:ComboBatchDraft;localTotalCents:number|null;
  localUnitCount:number;localFingerprint:string;
}>;
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function ComboUnitServerQuotePanel({comboId,batch,localTotalCents,localUnitCount,localFingerprint}:Props){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [quote,setQuote]=useState<ComboServerQuote|null>(null);
  const [releaseGate,setReleaseGate]=useState<ComboOrderV3Candidate|null>(null);
  const [paper,setPaper]=useState<'58'|'80'>('58');
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  const check=async()=>{
    if(busy)return;
    active.current?.abort();
    const controller=new AbortController();active.current=controller;
    setBusy(true);setError('');setQuote(null);setReleaseGate(null);
    try{
      const token=await auth.currentUser?.getIdToken();
      if(!token)throw Error('Faça login como administrador para conferir.');
      const response=await fetch('/api/admin/combo-unit-quote',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        cache:'no-store',signal:controller.signal,
        body:JSON.stringify({schema:1,comboId,batch}),
      });
      const data=await response.json().catch(()=>null) as {ok?:boolean;quote?:ComboServerQuote;releaseGate?:ComboOrderV3Candidate;error?:string}|null;
      if(controller.signal.aborted)return;
      if(!response.ok||!data?.ok||!data.quote){
        if(response.status===409)throw Error('O catálogo ou a composição mudou. Reabra a prévia e confira novamente.');
        if(response.status===401||response.status===403)throw Error('Acesso administrativo não autorizado.');
        throw Error('Não foi possível conferir os preços agora. A compra continua bloqueada.');
      }
      const next=data.quote;
      if(next.schema!==1||next.status!=='review_only'||next.quoteIsPayable!==false||
        next.authorization.checkout!==false||next.authorization.payment!==false||
        next.authorization.order!==false||next.authorization.print!==false||
        next.authorization.relay!==false||next.authorization.production!==false||
        next.productId!==comboId||next.blueprintFingerprint!==localFingerprint||
        next.unitCount!==localUnitCount)throw Error('Resposta incompatível. Reabra o laboratório e tente novamente.');
      const gate=data.releaseGate;
      if(!gate||gate.contract!=='dfl_site_combo_order_v3_candidate'||gate.orderSchemaVersion!==3||
        gate.state!=='certification_only'||gate.authorization.checkout!==false||
        gate.authorization.payment!==false||gate.authorization.persist!==false||gate.authorization.relay!==false||
        gate.authorization.print!==false||gate.authorization.production!==false||
        gate.orderId!==null||gate.eventId!==null||gate.idempotencyKey!==null||
        gate.acceptance.status!=='blocked'||gate.acceptance.liveCheckoutReleased!==false||
        gate.productId!==comboId||gate.blueprintFingerprint!==next.blueprintFingerprint||
        gate.unitCount!==next.unitCount||gate.item.totalCents!==next.totalCents||
        gate.item.units.length!==next.rows.length)throw Error('Homologação incompleta. Não é possível ativar este contrato.');
      setQuote(next);setReleaseGate(gate);
    }catch(cause){
      if(controller.signal.aborted)return;
      setError(cause instanceof Error?cause.message:'Falha na conferência.');
    }finally{
      if(!controller.signal.aborted)setBusy(false);
    }
  };
  const delta=quote&&localTotalCents!==null?quote.totalCents-localTotalCents:null;
  return <section className={styles.root} aria-label="Conferência de preços com o servidor">
    <header className={styles.head}><div><span>✦ R248 · CONFERÊNCIA ADMINISTRATIVA</span><strong>Verificar preços no servidor</strong><p>Atualiza composição, disponibilidade e preços do catálogo antes de mostrar a prévia. Não cria pedido.</p></div><span className={styles.status}>SOMENTE LEITURA</span></header>
    <button type="button" className={styles.action} disabled={busy} onClick={()=>void check()}>
      {busy?'Conferindo dados atuais…':'Conferir com o servidor'}
    </button>
    {busy&&<p className={styles.wait} role="status">Consultando o catálogo da loja para este combo, sem alterar seus dados.</p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {quote&&releaseGate&&<ComboUnitV3AcceptancePanel candidate={releaseGate}/>}
    {quote&&<div className={styles.result} role="status">
      <div className={styles.summary}><div><small>Base por combo</small><b>{money(quote.basePricePerComboCents)}</b></div><div><small>Adicionais de todos os combos</small><b>{money(quote.extrasForOrderCents)}</b></div><div><small>Total conferido no servidor</small><strong>{money(quote.totalCents)}</strong></div></div>
      <p className={delta===0?styles.same:styles.changed}>
        {delta===null?'Conferido com os dados atuais do servidor.':delta===0?'Conferência consistente com a prévia local.':`Diferença em relação à prévia local: ${delta>0?'+':''}${money(delta)}. O catálogo mudou ou a configuração local precisa ser revista.`}
      </p>
      <div className={styles.combos}>{quote.combos.map(combo=><div key={combo.number}><span>Combo {combo.number}</span><b>{money(combo.totalCents)}</b><small>{money(combo.extrasCents)} extras</small></div>)}</div>
      <div className={styles.thermalTop}><strong>Conferência de montagem</strong><div role="group" aria-label="Largura da bobina simulada"><button type="button" aria-pressed={paper==='58'} onClick={()=>setPaper('58')}>58 mm</button><button type="button" aria-pressed={paper==='80'} onClick={()=>setPaper('80')}>80 mm</button></div></div>
      <pre className={styles.paper}>{(paper==='58'?quote.kitchenPreview58:quote.kitchenPreview80).join('\n')}</pre>
      <p className={styles.warning}>Conferência oficial de dados atuais, mas sem autorização para cobrar, confirmar, imprimir ou enviar ao Entregas. O checkout continua usando o contrato antigo.</p>
    </div>}
  </section>;
}
