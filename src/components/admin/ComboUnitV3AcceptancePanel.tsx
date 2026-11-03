'use client';
/** Read-only R249 release certification. Never renders a purchase or print action. */
import type {ComboOrderV3Candidate} from '@/lib/comboUnitOrderV3Candidate';
import styles from './ComboUnitV3AcceptancePanel.module.css';

export function ComboUnitV3AcceptancePanel({candidate}:{candidate:ComboOrderV3Candidate}){
  if(candidate.state!=='certification_only'||candidate.authorization.checkout!==false||
     candidate.authorization.persist!==false||candidate.acceptance.status!=='blocked')return null;
  const {acceptance,item}=candidate;
  return <section className={styles.root} aria-label="Homologação do contrato de combos versão 3" data-dfl-r249="blocked">
    <div className={styles.header}><div><span>✦ DFL · R249 · FECHAMENTO TÉCNICO</span>
      <h3>Contrato comercial por unidade</h3><p>O servidor confirmou as escolhas de cada lanche. A ativação continua protegida.</p></div>
      <b className={styles.flag}>AGUARDANDO HOMOLOGAÇÃO</b></div>
    <div className={styles.stats}>
      <div><small>Combos</small><strong>{candidate.comboCount}</strong></div>
      <div><small>Unidades</small><strong>{candidate.unitCount}</strong></div>
      <div><small>Personalizadas</small><strong>{candidate.customizedUnitCount}</strong></div>
    </div>
    <div className={styles.checks} aria-label="Critérios da homologação">
      <p className={styles.done}>✓ Preço recalculado no servidor</p>
      <p className={styles.done}>✓ Identidade e totais por lanche reconciliados</p>
      <p className={styles.done}>✓ Checkout atual preservado</p>
      <p className={styles.pending}>○ API de pedidos versão 3 ainda não habilitada</p>
      <p className={styles.pending}>○ Receptor do Entregas ainda recusa a versão 3</p>
      <p className={styles.pending}>○ Persistência, relay idempotente e impressão física ainda exigem homologação</p>
    </div>
    <details className={styles.details}><summary>Conferir unidades do futuro contrato</summary>
      <div className={styles.lines}>{item.units.map(unit=><div key={unit.key}>
        <strong>Combo {unit.comboNumber} · {unit.componentLabel} {unit.unitNumber}/{unit.groupQuantity}</strong>
        <span>{[...unit.addons.map(a=>`+ ${a.label}`),...unit.removals.map(r=>`Sem ${r.label}`),...(unit.note?[`Obs.: ${unit.note}`]:[])].join(' · ')||'Padrão'}</span>
      </div>)}</div>
    </details>
    <p className={styles.warning} role="status">Esta conferência não cria pedidos, não cobra valores, não imprime e não envia dados ao Entregas. O pedido tradicional continua funcionando normalmente.</p>
    <small className={styles.footer}>Contrato candidato V3 · {acceptance.blockers.length} etapas de liberação pendentes · somente Admin</small>
  </section>;
}
