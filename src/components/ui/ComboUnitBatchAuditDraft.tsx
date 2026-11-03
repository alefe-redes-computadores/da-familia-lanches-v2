"use client";
/** R245 - inert, read-only per-combo kitchen/Entregas audit. Not mounted in public checkout. */
import type {ComboBatchHandoffPreview} from '@/lib/comboUnitBatchHandoffDraft';
import styles from './ComboUnitBatchAuditDraft.module.css';
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function ComboUnitBatchAuditDraft({preview}:{preview:ComboBatchHandoffPreview}){
  if(preview.status!=='preview_only'||preview.canSend!==false||preview.authorized.checkout!==false||preview.authorized.print!==false||preview.authorized.relay!==false){
    return <p role="alert">Prévia inválida: exportação bloqueada.</p>;
  }
  return <section className={styles.root} data-release="preview-only" aria-label="Conferência isolada dos combos para cozinha e Entregas">
    <header><span className={styles.eyebrow}>DFL LAB · R245 · SEM ENVIO</span><h3>Conferência da cozinha</h3>
      <p>Confira as escolhas de cada combo. Este espelho não é um pedido, não imprime e não autoriza cobrança.</p>
    </header>
    <div className={styles.metrics}><span><b>{preview.comboCount}</b> combos</span><span><b>{preview.unitCount}</b> unidades</span><span><b>{money(preview.totalPreviewCents)}</b> simulado</span></div>
    {preview.segments.map(segment=><details key={segment.identity} className={styles.segment}>
      <summary><strong>Combo {segment.number}</strong><span>{money(segment.totalCents)} · prévia</span></summary>
      <div className={styles.lines}>
        {segment.receiverDraft.units.map(unit=><div className={styles.line} key={unit.unitKey}>
          <strong>{unit.productLabel} {unit.unitNumber}/{unit.groupQuantity}</strong>
          <span>{[...unit.addons.map(a=>`+ ${a.label}`),...unit.removals.map(a=>`Sem ${a.label}`),...(unit.note?[unit.note]:[])].join(' · ')||'Padrão'}</span>
        </div>)}
      </div>
    </details>)}
    <footer role="status">Receptor real ainda não homologado para pedidos individuais. Nenhuma alteração operacional foi realizada.</footer>
  </section>;
}
