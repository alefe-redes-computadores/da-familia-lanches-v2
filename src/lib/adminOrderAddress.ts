type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (...values: unknown[]) => values.map(value => String(value ?? "").trim()).find(Boolean) ?? "";

export function adminOrderAddress(orderValue: unknown) {
  const order=record(orderValue);
  const delivery=record(order.deliverySnapshot);
  const address=record(order.addressSnapshot);
  const source={...address,...delivery};
  const street=text(source.street,source.rua,source.logradouro,order.rua);
  const number=text(source.number,source.numero,order.numero);
  const district=text(source.district,source.bairro,order.bairro);
  const complement=text(source.complement,source.complemento,order.complemento);
  const reference=text(source.reference,source.referencia,order.referencia);
  const legacy=text(order.endereco,order.address);
  const location=[street,number].filter(Boolean).join(street&&number?", ":"");
  const primary=[location,complement&&`(${complement})`,district&&`— ${district}`].filter(Boolean).join(" ");
  const full=[primary||legacy,reference&&`Ref.: ${reference}`].filter(Boolean).join(" · ");
  const summary=primary||legacy;
  return {street,number,district,complement,reference,summary,full};
}
