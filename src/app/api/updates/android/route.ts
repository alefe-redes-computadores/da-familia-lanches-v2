import { NextRequest, NextResponse } from 'next/server';
import { APK_GITHUB_REPOSITORY, isAndroidFlavor, latestVerifiedRelease } from '@/lib/android-updates/policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const API = `https://api.github.com/repos/${APK_GITHUB_REPOSITORY}`;
const HEADERS = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'DFL-Site-Android-Update-Certifier' };
const NO_STORE = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };

async function jsonFromGithub(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 }, signal: controller.signal });
    if (!res.ok) throw new Error(`github_status_${res.status}`);
    return await res.json() as unknown;
  } finally { clearTimeout(timeout); }
}

/** API publica, somente leitura e fail-closed. Nao expõe tokens nem segredos. */
export async function GET(req: NextRequest) {
  const flavor = req.nextUrl.searchParams.get('app');
  if (!isAndroidFlavor(flavor)) return NextResponse.json({ ok: false, error: 'app_invalid' }, { status: 400, headers: NO_STORE });
  try {
    const [runs, releases] = await Promise.all([
      jsonFromGithub(`${API}/actions/workflows/build-admin-android.yml/runs?branch=main&status=success&per_page=60`),
      jsonFromGithub(`${API}/releases?per_page=50`),
    ]);
    const release = latestVerifiedRelease(runs, { releases: Array.isArray(releases) ? releases : [] }, flavor);
    return NextResponse.json({ ok: true, app: flavor, available: Boolean(release), release }, { headers: NO_STORE });
  } catch {
    // Um erro do GitHub nao significa versao nova. Nao usar dados antigos como se fossem atuais.
    return NextResponse.json({ ok: false, error: 'verification_unavailable', available: false }, { status: 503, headers: NO_STORE });
  }
}
