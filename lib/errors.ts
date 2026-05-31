import { isRecord } from './typeGuards'

/**
 * Estrae un messaggio leggibile da un error unknown (Error, oggetto, stringa).
 * Fallback di default: "Errore generico".
 */
export function getMessaggioErrore(
  error: unknown,
  fallback = 'Errore generico'
): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (isRecord(error)) {
    const e = error as Record<string, unknown>
    if (typeof e.message === 'string') return e.message
    if (typeof e.error === 'string') return e.error
    if (typeof e.errore === 'string') return e.errore
    if (typeof e.errorMessage === 'string') return e.errorMessage
  }
  return fallback
}

/**
 * Estrae messaggio errore da payload JSON di risposta API.
 * Controlla: errore, error, errorMessage, message in ordine.
 * Fallback di default: "Errore generico".
 */
export function getMessaggioErroreApi(
  payload: unknown,
  fallback = 'Errore generico'
): string {
  if (!isRecord(payload)) return fallback
  const p = payload as Record<string, unknown>
  if (typeof p.errore === 'string') return p.errore
  if (typeof p.error === 'string') return p.error
  if (typeof p.errorMessage === 'string') return p.errorMessage
  if (typeof p.message === 'string') return p.message
  return fallback
}
