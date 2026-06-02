import type { NextRequest } from 'next/server'
import { API_HEADERS } from '@/constants/api'

/**
 * Estrae il token Bearer dall'header Authorization.
 * Ritorna null se assente o malformato.
 */
export function estraiBearerToken(
  request: Request | NextRequest
): string | null {
  const authorization = request.headers.get(
    API_HEADERS.AUTHORIZATION
  )

  if (!authorization?.startsWith(API_HEADERS.BEARER_PREFIX)) {
    return null
  }

  const token = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim()

  return token || null
}
