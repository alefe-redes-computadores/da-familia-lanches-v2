type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (...values: unknown[]) => values.map(value => String(value ?? "").trim()).find(Boolean) ?? "";

export function adminOrderAddress(orderValue: unknown) {
  const order=record(orderValue);
  const delivery=record(order.deliverySnapshot);
  const address=record(order.addressSnapshot);
  // Snapshots parciais não podem apagar um campo válido do outro snapshot.
  // A prioridade é entrega, depois endereço salvo e depois campos legados.
  const street=text(delivery.street,delivery.rua,delivery.logradouro,address.street,address.rua,address.logradouro,order.rua);
  const number=text(delivery.number,delivery.numero,address.number,address.numero,order.numero);
  const district=text(delivery.district,delivery.bairro,address.district,address.bairro,order.bairro);
  const complement=text(delivery.complement,delivery.complemento,address.complement,address.complemento,order.complemento);
  const reference=text(delivery.reference,delivery.referencia,address.reference,address.referencia,order.referencia);
  const legacy=text(order.endereco,order.address);
  const location=[street,number].filter(Boolean).join(street&&number?", ":"");
  const primary=[location,complement&&`(${complement})`,district&&`— ${district}`].filter(Boolean).join(" ");
  // Sem rua estruturada, endereço legado completo prevalece sobre bairro/número isolados.
  const summary=street ? (primary||legacy) : (legacy||primary);
  const full=[summary,reference&&`Ref.: ${reference}`].filter(Boolean).join(" · ");
  return {street,number,district,complement,reference,summary,full};
}
