// Checklist Wall Box: oggi è una feature verticale nata per Edison/A2C
// Sistemi, non ancora generalizzata alle altre aziende clienti. Questo
// controllo è solo di VISIBILITÀ: i dati restano comunque isolati per
// azienda_id via RLS come ogni altra tabella, quindi non è un confine di
// sicurezza. Verrà sostituito dal sistema generale di moduli per
// piano/azienda quando quello sarà pronto.
function getAziendeAutorizzateWallbox(): string[] {
  return (process.env.NEXT_PUBLIC_WALLBOX_AZIENDA_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAziendaAutorizzataWallbox(
  aziendaId: string | null | undefined
): boolean {
  if (!aziendaId) return false;
  return getAziendeAutorizzateWallbox().includes(aziendaId);
}
