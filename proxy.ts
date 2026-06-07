import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { APP_ROUTES } from "@/constants/routes";

const LANDING_DOMAIN = "cantivo.it";

const PUBLIC_ROUTES = [
  "/login",
  "/landing",
  "/registrati",
  "/privacy",
  "/termini",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function proxy(request: NextRequest) {
  // Must run first so any token refresh gets written to the response cookies.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hostname = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Landing domain rewrite: cantivo.it serves the /landing page at "/"
  const isLandingDomain =
    hostname === LANDING_DOMAIN || hostname === `www.${LANDING_DOMAIN}`;

  if (
    isLandingDomain &&
    !pathname.startsWith("/landing") &&
    !pathname.startsWith("/registrati") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/timbrature") &&
    !pathname.startsWith("/api")
  ) {
    if (user) {
      return NextResponse.redirect(new URL(APP_ROUTES.TIMBRATURE, request.url));
    }
    const rewrite = NextResponse.rewrite(new URL("/landing", request.url));
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => rewrite.cookies.set(c.name, c.value));
    return rewrite;
  }

  // Auth guards for the app domain
  if (user && (pathname === "/login" || pathname.startsWith("/landing"))) {
    return NextResponse.redirect(new URL(APP_ROUTES.TIMBRATURE, request.url));
  }

  if (!user && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
