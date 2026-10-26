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

/** R7: transposição (Jsoe), substituição e acentos sem chamadas de rede.
 * Somente SUGERE; não escolhe bairro automaticamente ou altera tabela de frete.
 */
function districtEditDistance(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const grid = Array.from({length:a.length + 1}, () => Array<number>(b.length + 1).fill(0));
  for (let i=0;i<=a.length;i++) grid[i][0]=i;
  for (let j=0;j<=b.length;j++) grid[0][j]=j;
  for (let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    const cost=a[i-1]===b[j-1]?0:1;
    grid[i][j]=Math.min(grid[i-1][j]+1,grid[i][j-1]+1,grid[i-1][j-1]+cost);
    if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1])
      grid[i][j]=Math.min(grid[i][j],grid[i-2][j-2]+1);
  }
  return grid[a.length][b.length];
}

export function suggestDistricts(value: unknown, configured: string[] = [], limit = 5): string[] {
  const key=normalizeDistrict(value);
  if (key.length < 3) return [];
  const words=key.split(' ');
  const candidates=choices(configured).map(name => {
    const candidate=normalizeDistrict(name);
    if (candidate===key) return {name,score:-1};
    if (candidate.startsWith(key)) return {name,score:100 - (candidate.length-key.length)*0.1};
    if (candidate.includes(key) && key.length>=4) return {name,score:80};
    // Tokens de nomes compostos: "Sao Jsoe Operario" e "Sao Jose Operario".
    const target=candidate.split(' ');
    const full=key.length>=5?districtEditDistance(key,candidate):100;
    const tokenSum=words.length===target.length ? words.reduce((sum,w,i)=>sum+districtEditDistance(w,target[i]),0) : 100;
    const allowance=key.length>=13?3:key.length>=7?2:1;
    const distance=Math.min(full,tokenSum);
    if (distance>allowance) return {name,score:-1};
    return {name,score:60-distance*9};
  }).filter(x=>x.score>=0);
  return candidates.sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name,'pt-BR'))
    .slice(0,Math.max(0,Math.min(limit,8))).map(x=>x.name);
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
