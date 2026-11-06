/** R291: policy pure, OFF unless three independent production switches are explicit. */
export type PrintTicketKind = 'kitchen' | 'full';
export type PrintJobPlan = { id: string; order_id: string; kind: PrintTicketKind; paper_mm: '58' | '80'; protocol: 'dfl.print.job.v1'; source: 'site' };

type Env = Record<string, string | undefined>;
export function planSitePrintJobs(orderId: string, scheduled: boolean, env: Env): PrintJobPlan[] {
  if (scheduled || !/^site_[a-f0-9]{40}$/.test(orderId)) return [];
  if (env.DFL_PRINT_AUTO_ENABLED !== 'true' || env.DFL_PRINT_AGENT_ENABLED !== 'true') return [];
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(env.DFL_PRINT_AGENT_TOKEN ?? '')) return [];
  if (env.DFL_PRINT_PAPER_MM !== '58' && env.DFL_PRINT_PAPER_MM !== '80') return [];
  if (env.DFL_PRINT_AUTO_TICKET_MODE !== 'kitchen' && env.DFL_PRINT_AUTO_TICKET_MODE !== 'both') return [];
  const kinds: PrintTicketKind[] = env.DFL_PRINT_AUTO_TICKET_MODE === 'both' ? ['kitchen', 'full'] : ['kitchen'];
  return kinds.map(kind => ({
    id: `print-v1__${orderId}__${kind}`, order_id: orderId, kind,
    paper_mm: env.DFL_PRINT_PAPER_MM as '58' | '80', protocol: 'dfl.print.job.v1', source: 'site',
  }));
}
export function printOrderBlocked(status: unknown): boolean {
  const s = String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /(cancel|rejeit|estorn|agendad|nao aprovado|fraude)/.test(s);
}
export const PRINT_JOB_MAX_AGE_MS = 30 * 60 * 1000;
