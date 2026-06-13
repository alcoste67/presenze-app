# Fase D — SAL valorizzato + ciclo bozza/definitivo

Stato al 2026-06-13 (preparato in autonomia mentre Alex era assente).
**Build `npm run build`: verde.** Niente committato, niente eseguito su DB.

## Obiettivo
1. **SAL valorizzato**: il committente valorizza `prezzo × quantità × %` sulle
   PROPRIE voci, per la contabilità verso il cliente finale. I prezzi restano
   **privati**: mai sulle voci del subappaltatore (snapshot collaborazioni =
   solo nome + %).
2. **Ciclo bozza → definitivo**: il SAL periodo nasce `bozza` (modificabile /
   rigenerabile / annullabile), il pulsante "Conferma" lo porta a `definitivo`
   (immutabile, lock enforced a livello DB come i rapporti firmati).

## FATTO (pronto, build-verified)

### DB — `migrations/task14_sal_valorizzato.sql` (da eseguire DEV → PROD)
- `sal_freeze_lavorazioni`: + `unita_misura_snapshot`, `quantita_snapshot`,
  `prezzo_unitario_snapshot`, `importo_totale`, `importo_maturato`,
  `importo_periodo` (tutte nullable).
  - `importo_totale` = quantità × prezzo
  - `importo_maturato` = importo_totale × %attuale/100 (cumulato a questo SAL)
  - `importo_periodo` = importo_totale × delta%/100 (competenza del periodo)
- `sal_freeze_mensili`: + `stato` ('bozza'|'definitivo', default 'bozza'),
  `confermato_at`, `confermato_by`.
- Trigger di lock: un freeze `definitivo` è immutabile (header + figlie:
  lavorazioni/foto/macchinari/collaborazioni). Unica eccezione: annullamento
  (solo `annullato_at`/`by`). Stile identico a `blocca_rapporto_firmato`.

### Codice
- `types/salFreeze.ts`: campi valorizzazione su `SalFreezeLavorazione`;
  `stato`/`confermato_*` su `SalFreezeMensile`; tipo `StatoSalFreeze`.
- `services/salFreeze/createSalFreeze.ts`: legge quantità/prezzo/UM da
  `lavorazioni_cantiere`, calcola gli importi e li congela nello snapshot.
  Header restituito con `stato='bozza'`.
- `services/salFreeze/confermaSalFreeze.ts` (nuovo): bozza → definitivo, solo
  ADMIN, con i controlli (non trovato / già annullato / già definitivo).
- `app/api/sal-freeze/conferma/route.ts` (nuovo): POST `{freezeId}`, mirrorata
  su `annulla`. Costante `API_ROUTES.SAL_FREEZE_CONFERMA`.
- `app/api/sal-freeze/dettaglio/route.ts` + `loadSalFreezeExportCommittente.ts`:
  SELECT estesi con importi + stato.
- `app/api/report/sal-freeze-excel/route.ts`: foglio SAL con colonne U.M.,
  Quantità, Prezzo unit., Importo totale/maturato/periodo + riga TOTALE.
  Le voci del subappaltatore restano **senza prezzi**.

### Punto 3 (risolto da Alex 2026-06-13) — comportamento in bozza
Decisione: **Rigenera** ricalcola tutto dagli avanzamenti correnti (sovrascrive,
usato quando si aggiungono percentuali). **Edit a mano** per riga: correggere
discrepanze; importi calcolati in automatico ma sovrascrivibili a mano.
Implementato così:
- `services/salFreeze/rigeneraSalFreeze.ts` + `POST /api/sal-freeze/rigenera`:
  ricalcola lavorazioni + collaborazioni in-place (solo bozza), tiene
  header/foto/macchinari, aggiorna freeze_at. Riusa gli helper esportati da
  createSalFreeze.
- `services/salFreeze/aggiornaSalFreezeLavorazione.ts` + `POST
  /api/sal-freeze/lavorazione`: edita una riga (solo bozza). Cambiando la %
  ricalcola delta + importi; gli importi possono essere forzati a mano (override).

### PDF — FATTO (parziale)
`app/api/report/sal-freeze-pdf/route.ts`: aggiunto blocco **totali valorizzati**
(Totale maturato + Totale periodo) sotto la tabella. Le colonne importo per-riga
NON sono state aggiunte: la tabella PDF è a larghezza fissa (~502pt) e
sfonderebbe l'A4 → eventuale redesign da fare guardando il risultato a video.

### UI pagina SAL periodo — FATTO
`app/backoffice/sal-freeze/page.tsx`:
- badge stato (Bozza/Definitivo)
- bottoni **Rigenera** + **Conferma SAL periodo** (solo bozza + ADMIN)
- tabella con colonne U.M./Q.tà/Prezzo/Importo maturato/Importo periodo + riga TOTALE
- **edit inline per riga** ("Correggi" → input % / importi → Salva/Annulla), solo bozza

## DA DECIDERE / VERIFICARE A VIDEO
1. **Freeze esistenti**: `task14` li lascia `bozza` (rigenerabili). UPDATE
   commentata nella migration se vuoi marcarli `definitivo` da subito.
2. **Colonne importo per-riga nel PDF** (oltre ai totali) — serve redesign layout.
3. Test end-to-end su DEV (vedi checklist in fondo a task14).

## STATO: tutto build-verified (`npm run build` + `tsc --noEmit` puliti).
File toccati: types/salFreeze.ts, constants/api.ts, createSalFreeze.ts (+ export
helper), nuovi confermaSalFreeze/rigeneraSalFreeze/aggiornaSalFreezeLavorazione,
3 nuove route (conferma/rigenera/lavorazione), dettaglio route + loadSalFreezeExportCommittente,
sal-freeze-excel, sal-freeze-pdf, app/backoffice/sal-freeze/page.tsx.

## Ordine migration aggiornato verso PROD
... task6*, task8b, task11, task12, task13, **task14**.
