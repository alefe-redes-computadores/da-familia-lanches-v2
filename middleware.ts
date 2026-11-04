import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  // R253: confidential tracking entry. No third-party scripts, frames, cache or referrer.
  const tracking = request.nextUrl.pathname === '/acompanhar' || request.nextUrl.pathname.startsWith('/acompanhar/');
  if (tracking && host !== 'admin.dafamilialanches.com.br') {
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const csp = [
      "default-src 'none'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ].join('; ');
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    const response = NextResponse.next({request:{headers}});
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    return response;
  }
  if (host !== "admin.dafamilialanches.com.br") return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
