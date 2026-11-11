/** R58: busca instantanea, local, tolerante a digitacao e sem I/O. */
export type QuickSearchEntry = { name: string; hint: string; terms: string };
export const normalizeQuickSearch = (text: string) => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function boundedDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const score = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost);
      row.push(score);
      if (score < min) min = score;
    }
    if (min > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

function tokenScore(token: string, words: string[], whole: string): number {
  if (words.includes(token)) return 130;
  if (words.some(word => word.startsWith(token) && token.length >= 3)) return 105;
  if (token.length >= 3 && whole.includes(token)) return 78;
  if (token.length < 4) return 0; // termos curtos nao geram falsos positivos
  const max = token.length >= 6 ? 2 : 1;
  let closest = max + 1;
  for (const word of words) {
    if (word.length < 4 || word[0] !== token[0]) continue;
    const distance = boundedDistance(token, word, max);
    if (distance < closest) closest = distance;
    if (closest === 1) break;
  }
  return closest <= max ? 55 - (closest - 1) * 10 : 0;
}

export function quickSearchScore(entry: QuickSearchEntry, raw: string): number {
  const query = normalizeQuickSearch(raw.slice(0, 100));
  if (!query) return 1;
  const terms = query.split(' ').filter(Boolean).slice(0, 6);
  const name = normalizeQuickSearch(entry.name);
  const haystack = normalizeQuickSearch(`${entry.name} ${entry.hint} ${entry.terms}`);
  const words = haystack.split(' ').filter(Boolean);
  let total = name === query ? 500 : name.startsWith(query) ? 260 : 0;
  for (const token of terms) {
    const score = tokenScore(token, words, haystack);
    if (!score) return 0;
    total += score;
  }
  return total;
}
