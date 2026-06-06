import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_DOMAIN = 'cantivo.it'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const pathname = request.nextUrl.pathname

  // Se il dominio è cantivo.it e non si è già su /landing o /registrati o /login
  if (
    (hostname === LANDING_DOMAIN || hostname === `www.${LANDING_DOMAIN}`) &&
    !pathname.startsWith('/landing') &&
    !pathname.startsWith('/registrati') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.rewrite(new URL('/landing', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp).*)',
  ],
}
