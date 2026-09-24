import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (host !== "admin.dafamilialanches.com.br") return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
