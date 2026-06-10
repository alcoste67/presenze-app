# Cantivo — Regole di progetto per Claude Code

## Contesto
Cantivo (cantivo.it) è una PWA SaaS multi-tenant per gestione presenze
e cantieri. Sviluppatore unico: Alex. Aziende clienti isolate per `azienda_id`.

## Stack
- Next.js 16 + Turbopack, App Router
- Supabase (PostgreSQL + RLS) — DEV: mkfedjazibcmstkjxkfm, PROD: skdtczhvxvawwjanciss
- Vercel (dominio cantivo.it)
- Tailwind v4 con design token inline in `@theme` — NON creare file di config Tailwind
- pdf-lib per generazione PDF
- Resend per email transazionali (mittente @cantivo.it)
- Anthropic API (claude-sonnet-4-5) per import AI lavorazioni
- iubenda per GDPR

## REGOLE NON NEGOZIABILI

### Git
- MAI eseguire `git push`. Mai. I push li fa solo Alex, manualmente.
- MAI committare senza che Alex abbia revisionato il diff.
- Il deploy avviene SOLO da `main`. Non lavorare mai sul branch `dev`.
- Mostrare sempre il diff completo prima di proporre un commit.

### Multi-tenancy / Sicurezza (CRITICO — qui ci sono già stati data leak)
- OGNI nuova tabella DEVE avere colonna `azienda_id` e policy RLS
  RESTRICTIVE basata su `current_azienda_id()`, come le tabelle esistenti.
- OGNI INSERT deve passare `azienda_id` esplicito. Mai affidarsi a default.
- I bucket Storage usano path con prefix `{azienda_id}/...` e policy allineate.
- Mai esporre dati cross-tenant in query, API route o componenti server.
- Mai creare viste con SECURITY DEFINER: usare sempre security_invoker = true.

### Database
- Le migration si scrivono come SQL, Alex le esegue manualmente su DEV,
  verifica, e solo dopo le applica su PROD. Mai eseguire SQL su PROD.
- Mai DROP o ALTER distruttivi senza segnalarlo esplicitamente in evidenza.

### Integrità dei rapporti di lavoro
- I rapporti con stato 'firmato' o 'inviato' sono IMMUTABILI: il lock è
  enforced a livello DB (RLS/trigger), non solo in UI. Vale anche per le
  tabelle figlie (lavori extra, foto collegate).
- Il PDF inviato al cliente è la copia legale: generato una volta,
  archiviato su Storage, mai rigenerato.

### PWA
- Attenzione al routing e alla history del browser: ci sono stati bug PWA
  già corretti. Testare sempre back button e refresh dopo modifiche alle route.
- I cookie di sessione hanno avuto problemi: non modificare la gestione
  sessioni senza segnalarlo.

### UI
- Dropdown/overlay: usare React portal (bug z-index già risolto così).
- Attenzione a useEffect/useMemo nei Toast (bug infinite loop già risolto).
- Mobile-first: gli utenti principali sono operai in cantiere su smartphone,
  spesso con rete 4G scarsa. Comprimere le immagini client-side prima
  dell'upload.

## Workflow
1. Leggi il task da `ROADMAP.md` ed esegui i task in ordine di numerazione.
2. Proponi un piano breve (file toccati, migration necessarie, rischi).
3. Attendi conferma di Alex prima di implementare.
4. Implementa, esegui `npm run build` per verificare.
5. Mostra il diff. Alex committa e pusha.
6. Un task alla volta: mai iniziare il task successivo senza che il
   precedente sia stato committato da Alex.

## Lingua
- UI e contenuti utente: italiano.
- Codice, nomi variabili e commenti: coerenti con lo stile esistente del repo.