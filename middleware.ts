import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verifySessionToken,
  verifyWnToken,
  SESSION_COOKIE,
  WN_COOKIE,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  const isLoginPage = pathname === "/login";
  // The hidden /wn area has its own lock and does not need the main login.
  const isWnArea =
    pathname === "/wn" ||
    pathname.startsWith("/wn/") ||
    pathname.startsWith("/api/wn/");

  // Old /login?from=/wn links -> straight to the /wn lock screen
  const from = request.nextUrl.searchParams.get("from") ?? "";
  if (isLoginPage && (from === "/wn" || from.startsWith("/wn/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/wn";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Not signed in and trying to reach a protected page -> go to login
  if (!session && !isLoginPage && !isWnArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in and visiting login -> go to dashboard
  if (session && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Hidden /wn area: needs its own unlock on top of the main session.
  const isWnLock = pathname === "/wn";
  const isWnInner = pathname.startsWith("/wn/");
  const isWnApi =
    pathname.startsWith("/api/wn/") &&
    pathname !== "/api/wn/login" &&
    pathname !== "/api/wn/logout";

  if (isWnLock || isWnInner || isWnApi) {
    const wn = await verifyWnToken(request.cookies.get(WN_COOKIE)?.value);

    if (!wn && isWnApi) {
      return NextResponse.json({ error: "Locked." }, { status: 401 });
    }
    if (!wn && isWnInner) {
      const url = request.nextUrl.clone();
      url.pathname = "/wn";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (wn && isWnLock) {
      const url = request.nextUrl.clone();
      url.pathname = "/wn/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
