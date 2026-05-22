import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const internalRoutes = ["/gestao", "/admin", "/estoque", "/erp"];
const publicFiles = ["/favicon.ico", "/robots.txt", "/sitemap.xml"];

function isSiteLaunched() {
  return process.env.SITE_LAUNCHED === "true" || process.env.NEXT_PUBLIC_SITE_LAUNCHED === "true";
}

function isInternalPath(pathname: string) {
  return internalRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAllowedWhenClosed(pathname: string) {
  return (
    pathname === "/em-breve" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/products/") ||
    pathname.startsWith("/uploads/") ||
    publicFiles.includes(pathname) ||
    isInternalPath(pathname)
  );
}

export function middleware(request: NextRequest) {
  if (isSiteLaunched()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isAllowedWhenClosed(pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/em-breve";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!.*\\.).*)"]
};
