import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "bookvella.session";

export function proxy(request: NextRequest) {
  const hasSessionMarker = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSessionMarker) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
