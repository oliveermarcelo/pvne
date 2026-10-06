import { NextResponse, type NextRequest } from "next/server";

/**
 * Primeira barreira (rápida, sem banco): exige cookie de sessão nas áreas logadas.
 * A validação real da sessão e do papel (admin) acontece no servidor em cada página/action.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("pvne_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/conta/:path*", "/admin/:path*"] };
