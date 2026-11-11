/** DFL R56 — somente releases Android verificaveis; nao confundir deploy web com APK. */
export type AndroidFlavor = 'admin' | 'cliente';
export const APK_GITHUB_REPOSITORY = 'alefe-redes-computadores/da-familia-lanches-v2' as const;
const WORKFLOW_PATH = '.github/workflows/build-admin-android.yml';
const LIMIT_BYTES = 150 * 1024 * 1024;
const MIN_BYTES = 64 * 1024;
const TARGETS: Record<AndroidFlavor, { tag: string; asset: string; packageId: string }> = {
  admin: { tag: 'dfl-admin-android-', asset: 'DFL-Admin-', packageId: 'br.com.dafamilialanches.admin' },
  cliente: { tag: 'dfl-cliente-android-', asset: 'DFL-Cliente-', packageId: 'br.com.dafamilialanches.cliente' },
};
export type VerifiedAndroidRelease = {
  app: AndroidFlavor;
  packageId: string;
  build: number;
  sha256: string;
  bytes: number;
  commitSha: string;
  createdAt: string;
  pageUrl: string;
  downloadUrl: string;
};
export type VerifiedRun = { id: number; build: number; sha: string };
type Dict = Record<string, unknown>;
const record = (x: unknown): Dict | null => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Dict : null;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40}$/.test(v);
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
export const isAndroidFlavor = (x: unknown): x is AndroidFlavor => x === 'admin' || x === 'cliente';

/** Uma Action concluida com sucesso e do branch correto e requisito minimo. */
export function parseSuccessfulRun(value: unknown): VerifiedRun | null {
  const r = record(value);
  if (!r || !positive(r.id) || !positive(r.run_number) || !sha(r.head_sha) ||
      r.head_branch !== 'main' || r.status !== 'completed' || r.conclusion !== 'success' ||
      (r.event !== 'push' && r.event !== 'workflow_dispatch')) return null;
  const path = r.path;
  if (typeof path !== 'string' || !(path === WORKFLOW_PATH || path.startsWith(`${WORKFLOW_PATH}@`))) return null;
  return { id: r.id, build: r.run_number, sha: r.head_sha };
}

/** A Release so vale quando coincide EXATAMENTE com a Action aprovada, asset e digest. */
export function parseCertifiedRelease(value: unknown, run: VerifiedRun, app: AndroidFlavor): VerifiedAndroidRelease | null {
  const release = record(value);
  if (!release || release.draft !== false || release.prerelease !== false || !date(release.published_at) ||
      !sha(release.target_commitish) || release.target_commitish !== run.sha ||
      !Array.isArray(release.assets)) return null;
  const target = TARGETS[app];
  if (release.tag_name !== `${target.tag}${run.build}`) return null;
  const name = `${target.asset}${run.build}.apk`;
  const downloadUrl = `https://github.com/${APK_GITHUB_REPOSITORY}/releases/download/${target.tag}${run.build}/${name}`;
  const matched = release.assets.map(record).filter(a => a?.name === name && a?.state === 'uploaded');
  if (matched.length !== 1) return null;
  const asset = matched[0]!;
  if (!positive(asset.id) || !positive(asset.size) || asset.size < MIN_BYTES || asset.size > LIMIT_BYTES ||
      asset.browser_download_url !== downloadUrl || typeof asset.digest !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) return null;
  return {
    app, packageId: target.packageId, build: run.build,
    sha256: asset.digest.slice(7).toLowerCase(), bytes: asset.size,
    commitSha: run.sha, createdAt: release.published_at,
    pageUrl: `https://github.com/${APK_GITHUB_REPOSITORY}/releases/tag/${target.tag}${run.build}`,
    downloadUrl,
  };
}

/** Releases falsas, expiradas ou sem Action correspondente nao sao recomendadas. */
export function latestVerifiedRelease(runsBody: unknown, releasesBody: unknown, app: AndroidFlavor): VerifiedAndroidRelease | null {
  const rr = record(runsBody);
  const ll = record(releasesBody);
  if (!rr || !ll || !Array.isArray(rr.workflow_runs) || !Array.isArray(ll.releases)) return null;
  const runs = new Map<number, VerifiedRun>();
  for (const raw of rr.workflow_runs) {
    const run = parseSuccessfulRun(raw);
    if (run && !runs.has(run.build)) runs.set(run.build, run);
  }
  const eligible: VerifiedAndroidRelease[] = [];
  for (const raw of ll.releases) {
    const rel = record(raw);
    if (!rel || typeof rel.tag_name !== 'string') continue;
    const prefix = TARGETS[app].tag;
    if (!rel.tag_name.startsWith(prefix)) continue;
    const version = rel.tag_name.slice(prefix.length);
    if (!/^[1-9][0-9]{0,8}$/.test(version)) continue;
    const run = runs.get(Number(version));
    if (!run) continue;
    const parsed = parseCertifiedRelease(raw, run, app);
    if (parsed) eligible.push(parsed);
  }
  eligible.sort((a,b) => b.build - a.build);
  return eligible[0] || null;
}
