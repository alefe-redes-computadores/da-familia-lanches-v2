/** R32: desfazer limpeza nunca pode sobrescrever itens adicionados depois.
 * Nao toca no storage, precos, API, catalogo ou checkout.
 */
type CartRestoreLine = { cartId: string; quantity: number };
export function canRestoreClearedCart<T extends CartRestoreLine>(
  current: readonly T[], snapshot: readonly T[],
): boolean {
  return current.length === 0 && snapshot.length > 0 && snapshot.every((line) =>
    typeof line?.cartId === "string" && line.cartId.length > 0 &&
    Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 30,
  );
}
