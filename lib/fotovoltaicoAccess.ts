// Catalogo moduli + checklist fotovoltaico: oggi disponibili solo per
// A2C Sistemi e le aziende che Alex abilita esplicitamente, non ancora
// generalizzate a tutte le aziende clienti. Questo controllo è solo di
// VISIBILITÀ: i dati restano comunque isolati per azienda_id via RLS
// come ogni altra tabella, quindi non è un confine di sicurezza. Stesso
// meccanismo di lib/wallboxAccess.ts.
function getAziendeAutorizzateFotovoltaico(): string[] {
  return (process.env.NEXT_PUBLIC_FOTOVOLTAICO_AZIENDA_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAziendaAutorizzataFotovoltaico(
  aziendaId: string | null | undefined
): boolean {
  if (!aziendaId) return false;
  return getAziendeAutorizzateFotovoltaico().includes(aziendaId);
}
