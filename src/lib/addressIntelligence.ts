/** V86 R1: inteligência de bairros local e sem consulta remota adicional.
 * Lista ilustrativa de nomes públicos de Patos de Minas; taxas de entrega
 * permanecem sob autoridade da tabela configurada pelo administrador.
 */
export const KNOWN_PATOS_DISTRICTS = [
  "Abner Afonso", "Afonso Queiroz", "Alto da Colina", "Alto da Serra",
  "Alto dos Caiçaras", "Alvorada", "Antônio Caixeta", "Bela Vista",
  "Belvedere", "Boa Vista", "Brasil", "Brasília", "Caiçaras",
  "Campos Elíseos", "Caramuru", "Centro", "Cerrado", "Cidade Jardim",
  "Cidade Nova", "Cônego Getúlio", "Copacabana", "Coração Eucarístico",
  "Cristo Redentor", "Eldorado", "Guanabara", "Ipanema", "Jardim América",
  "Jardim Califórnia", "Jardim Céu Azul", "Jardim Esperança",
  "Jardim Floresta", "Jardim Itamarati", "Jardim Panorâmico",
  "Jardim Paraíso", "Jardim Paulistano", "Jardim Peluzzo",
  "Jardim Quebec", "Jardim Vitória", "Lagoa Grande", "Lagoinha",
  "Morada da Serra", "Morada do Sol", "Nossa Senhora Aparecida",
  "Nossa Senhora das Graças", "Nossa Senhora de Fátima", "Nova Floresta",
  "Novo Horizonte", "Novo Planalto", "Padre Eustáquio", "Planalto",
  "Residencial Barreiro", "Residencial Gramado", "Residencial Monjolo",
  "Residencial Sorriso", "Rosário", "Santa Luzia", "Santa Terezinha",
  "Santo Antônio", "São Francisco", "São José Operário", "Sebastião Amorim",
  "Sobradinho", "Valparaíso", "Várzea", "Vila Garcia", "Vila Rosa",
] as const;

export function normalizeDistrict(value: unknown): string {
  return String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/^bairro\s+/, "")
    .replace(/\s+/g, " ");
}

function choices(extra: string[] = []): string[] {
  const all = [...extra, ...KNOWN_PATOS_DISTRICTS];
  const seen = new Set<string>();
  return all.filter((v) => {
    const key = normalizeDistrict(v);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function suggestDistricts(value: unknown, configured: string[] = [], limit = 5): string[] {
  const key = normalizeDistrict(value);
  if (!key) return [];
  const found = choices(configured).map((name) => ({ name, key: normalizeDistrict(name) }))
    .filter(({key: candidate}) => candidate !== key && (candidate.startsWith(key) ||
      (key.length >= 4 && candidate.includes(key))))
    .sort((a,b) => Number(b.key.startsWith(key)) - Number(a.key.startsWith(key)) ||
      a.key.length - b.key.length || a.name.localeCompare(b.name, "pt-BR"));
  return found.slice(0, Math.max(0, Math.min(8,limit))).map(item=>item.name);
}

export type DistrictInspection = { valid: boolean; reason: "empty" | "short" | "incomplete" | "ok"; suggestions: string[] };

export function inspectDistrict(value: unknown, configured: string[] = []): DistrictInspection {
  const key = normalizeDistrict(value);
  const suggestions = suggestDistricts(value, configured);
  if (!key) return {valid:false,reason:"empty",suggestions:[]};
  if (key.length < 3 || /^\d+$/.test(key) || /^(bairro|jardim|residencial|vila|rua|avenida|nao sei|a definir|sem bairro|xxx)$/.test(key))
    return {valid:false,reason:"short",suggestions};
  const exact = choices(configured).some(name=>normalizeDistrict(name)===key);
  // Um prefixo inequívoco ou típico de bairro não pode virar endereço completo.
  const extending = choices(configured).filter(name => {
    const candidate=normalizeDistrict(name);
    return candidate.startsWith(key) && candidate.length >= key.length + 3;
  });
  if (!exact && extending.length > 0)
    return {valid:false,reason:"incomplete",suggestions};
  return {valid:true,reason:"ok",suggestions};
}

export function matchDeliveryRate<T extends { nome?: unknown }>(value: unknown, rates: T[]): T | undefined {
  const key = normalizeDistrict(value);
  if (!key || !inspectDistrict(value, rates.map(r=>String(r.nome ?? ""))).valid) return undefined;
  // Correspondência exata normalizada: NUNCA "includes" para não cobrar
  // bairro aleatório se o cliente escreveu apenas "C", "Cor", etc.
  return rates.find(rate=>normalizeDistrict(rate.nome) === key);
}
