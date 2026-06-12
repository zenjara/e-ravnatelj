import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session-token";

/**
 * Proxy (formerly "middleware" pre-Next 16). Optimistic auth redirect only:
 * verifies the signed cookie and routes unauthenticated users to /login, and
 * authenticated users away from /login. The real security boundary is
 * `requireSession()` inside protected pages / route handlers.
 *
 * Note: `api` is excluded in the matcher so API routes return proper JSON/HTTP
 * statuses instead of being redirected to the login HTML page.
 */

const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = secret ? verifySessionToken(token, secret) : null;

  // Unauthenticated user trying to reach a protected route → /login
  if (!session && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user on /login → home
  if (session && isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
