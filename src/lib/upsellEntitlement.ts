/** R30: vinculo promocional local, sem leitura de rede nem alteracao de preco.
 * Quantidade elegivel = principais existentes - adicionais promocionais ja usados.
 */
type UpsellLine = { id: string; quantity: number; upsellSourceId?: string };
export function remainingUpsellUnits(lines: readonly UpsellLine[], sourceId: string, productId: string): number {
  if (!sourceId || !productId) return 0;
  const safeQuantity = (value: number) => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  let main = 0;
  let used = 0;
  for (const line of lines) {
    if (line.id === sourceId && !line.upsellSourceId) main += safeQuantity(line.quantity);
    if (line.id === productId && line.upsellSourceId === sourceId) used += safeQuantity(line.quantity);
  }
  return Math.max(0, main - used);
}
