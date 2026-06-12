# Cantivo — ROADMAP Sprint "Rapporto di Lavoro"

> I task sono numerati in **ordine di esecuzione**: si parte dal Task 0 e si procede in sequenza, un task alla volta, un commit alla volta.
> Branch di lavoro locale, push solo su `main` dopo verifica. Tutte le nuove tabelle/colonne seguono il pattern RLS RESTRICTIVE con `current_azienda_id()` e INSERT con `azienda_id` esplicito.

**Decisioni prese:**
- Lavorazioni proposte → colonna `stato` su tabella esistente (no tabella separata)
- Anagrafica clienti con selezione da DB + inserimento rapido; un cliente può avere più cantieri
- Il rapporto può contenere **lavori extra** non legati alle lavorazioni del cantiere
- Rapporto **immodificabile dopo la firma** (lock enforced a livello DB)
- Tasto "Invia": PDF via email a cliente, admin **e operaio compilatore in copia**

**Infrastruttura (completata):**
- Backup: tag git `pre-sprint-rapporti` + dump schema PROD (55 tabelle, 104 policy)
- Dominio `cantivo.it` verificato su Resend; `RESEND_API_KEY` configurata su Vercel
- OTP login Supabase migrati a `noreply@cantivo.it` (nuovo account Resend)

---

## TASK 0 — Fix Security Advisor: viste SECURITY DEFINER
**Priorità: CRITICA · Complessità: BASSA · Rischio: MEDIO (potenziale leak cross-tenant attivo)**

**Contesto:** il Security Advisor di Supabase segnala 2 issue CRITICAL su PROD: le viste `public.macchinari_pubblici` e `public.costi_macchinari_pubblici` sono definite con `SECURITY DEFINER`, quindi **scavalcano le policy RLS** delle tabelle sottostanti. In un'app multi-tenant è un potenziale leak di dati tra aziende.

**Lavoro richiesto (prima analisi, poi fix):**
1. Analizzare la definizione delle due viste: quali tabelle leggono, quali colonne espongono, se filtrano per `azienda_id`.
2. Cercare nel codice tutti i punti che usano queste viste (query, componenti, API route).
3. Stabilire l'intento: erano volutamente "pubbliche" (dati condivisi tra tutte le aziende, es. listino macchinari comune) o è una svista?
4. Fix proposto:
```sql
ALTER VIEW public.macchinari_pubblici SET (security_invoker = true);
ALTER VIEW public.costi_macchinari_pubblici SET (security_invoker = true);
```
   Con `security_invoker = true` le viste rispettano le RLS delle tabelle sottostanti. **Attenzione:** se le tabelle sotto filtrano per `azienda_id`, le schermate che usavano le viste potrebbero svuotarsi — verificare il comportamento atteso prima del fix. Se i dati devono davvero essere condivisi tra aziende, servirà una soluzione esplicita (tabella senza tenant o policy dedicata), non il bypass RLS.
5. Test completo su DEV (utenti di 2 aziende diverse: ognuno vede solo il dovuto), poi PROD.

**Nota:** questo è anche il task di rodaggio del workflow con Claude Code — solo analisi + una migration piccola.

---

## TASK 0.4 — Navigazione omogenea: tasto Back-office in ogni header
**Priorità: BASSA · Complessità: BASSA · Rischio: BASSO**

Ogni pagina vista da ADMIN/SUPERADMIN/RESPONSABILE deve avere il link "Back-office" nell'header (pattern `mostraBackoffice` già esistente in home timbrature). Pagine mancanti al 2026-06-10: `/storico`, `/timbrature`, `/admin` (+ `/abbonamento`, `/consumi`, `/dati`, `/fatturazione`), `/superadmin`. Le pagine pubbliche (login, landing, privacy, termini, registrati) restano senza.

---

## TASK 0.5 — Tipi macchinario gestibili per azienda
**Priorità: MEDIA · Complessità: MEDIA · Rischio: MEDIO (migrazione dati su 2 tabelle)**

**Obiettivo:** i tipi macchinario oggi sono una lista fissa nel codice (Scavatore, PLE, Autogru, Carotaggio, Altro) bloccata da CHECK constraint. Devono diventare gestibili dall'Admin per azienda.

- **DB:** tabella `tipi_macchinario` (`id`, `azienda_id`, `nome`, `attivo`) con policy RESTRICTIVE; seed dei 5 tipi attuali per ogni azienda esistente; rimozione dei CHECK su `macchinari.tipo` e `costi_macchinari_commessa.tipo_macchinario` e aggancio alla nuova tabella.
- **UI:** sezione "Tipi macchinario" nella pagina Anagrafica macchinari (admin): lista + aggiungi/rinomina/disattiva. I select di anagrafica e uso macchinari leggono dal DB.

---

## TASK 1 — Firma su pagina dedicata + macchina a stati + lock
**Priorità: ALTA · Complessità: BASSA-MEDIA · Rischio: BASSO**

**Obiettivo:** il tasto "Firma" apre una pagina dedicata (non più canvas nella pagina di compilazione). Dopo la firma il rapporto è **immodificabile**. Introduce la macchina a stati su cui poggiano tutti i task successivi.

**Macchina a stati:**
```
bozza → firmato → inviato
```

**DB:**
```sql
ALTER TABLE rapporti_lavoro ADD COLUMN stato TEXT NOT NULL DEFAULT 'bozza'
  CHECK (stato IN ('bozza', 'firmato', 'inviato'));
ALTER TABLE rapporti_lavoro ADD COLUMN firmato_il TIMESTAMPTZ;
ALTER TABLE rapporti_lavoro ADD COLUMN inviato_il TIMESTAMPTZ;

-- Lock: blocca ogni modifica a rapporti firmati/inviati,
-- eccetto la sola transizione firmato -> inviato
CREATE OR REPLACE FUNCTION blocca_rapporto_firmato()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('firmato', 'inviato') THEN
    IF OLD.stato = 'firmato' AND NEW.stato = 'inviato'
       AND NEW.firmato_il IS NOT DISTINCT FROM OLD.firmato_il THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Rapporto % non modificabile: stato %', OLD.id, OLD.stato;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_rapporto
  BEFORE UPDATE ON rapporti_lavoro
  FOR EACH ROW EXECUTE FUNCTION blocca_rapporto_firmato();
```
**Da completare in implementazione:** trigger gemello per il DELETE (su DELETE non esiste `NEW`, serve funzione separata) e trigger sulle tabelle figlie (lavori extra, foto collegate) che controllino lo stato del rapporto padre.

**Lock — enforcement a due livelli:**
1. UI: campi in sola lettura quando `stato != 'bozza'`.
2. DB: il trigger sopra. È il livello DB quello che conta legalmente — la sola UI si aggira.

**Pagina firma:**
- Route dedicata `/rapporti/[id]/firma`: canvas fullscreen, pulsanti "Cancella" e "Conferma firma". Route preferibile al modal per la PWA (back nativo, niente conflitti scroll/touch sul canvas).
- Prima della firma, schermata di **riepilogo completo**: "Stai per firmare, dopo non potrai più modificare il rapporto".
- Al conferma: salvataggio firma (mantenere il formato attuale), `stato = 'firmato'` + `firmato_il = now()`, redirect al rapporto con badge "Firmato ✓".

**Test obbligatori:**
- Firmare un rapporto di prova su DEV e tentare di modificarlo (deve fallire a livello DB).
- Back button e refresh dopo la firma — stessa area dei bug PWA routing già patchati.

---

## TASK 2 — Anagrafica clienti + campo committente nel rapporto
**Priorità: ALTA · Complessità: MEDIA · Rischio: BASSO**

**Obiettivo:** l'operaio/responsabile sceglie il cliente da anagrafica, oppure lo inserisce al volo se non presente. Un cliente può avere più cantieri attivi. L'email del cliente è il prerequisito del Task 5.

**DB:**
```sql
CREATE TABLE clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  ragione_sociale TEXT NOT NULL,
  email TEXT,            -- necessaria per Task 5 (invio PDF)
  telefono TEXT,
  indirizzo TEXT,
  note TEXT,
  creato_da UUID REFERENCES profiles(id),
  creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Policy RESTRICTIVE su azienda_id come le altre tabelle

ALTER TABLE cantieri ADD COLUMN cliente_id UUID REFERENCES clienti(id);
ALTER TABLE rapporti_lavoro ADD COLUMN cliente_id UUID REFERENCES clienti(id);
```

**Logica:**
- Se il cantiere ha un `cliente_id`, il rapporto si **precompila** con quel cliente (modificabile).
- Cliente assente: inserimento rapido inline (ragione sociale + email opzionale) senza uscire dal flusso del rapporto; la scheda completa si rifinisce dall'Admin.
- Autocomplete su `ragione_sociale`, filtrato per `azienda_id`.
- **Anti-doppioni soft:** nome molto simile a uno esistente (`pg_trgm`) → "Forse intendi: …" prima di creare il nuovo.

**Admin:** pagina anagrafica clienti (lista, modifica, merge doppioni, cantieri collegati).

---

## TASK 2.5 — Merge clienti doppioni (Admin)
**Priorità: BASSA · Complessità: MEDIA · Rischio: MEDIO · Dipende da: Task 2**

Unione di due schede cliente: ricollegamento automatico di cantieri e rapporti dal duplicato al cliente principale, poi disattivazione/eliminazione del duplicato. Rimandato dal Task 2 (deciso 2026-06-10): l'anti-doppioni soft in creazione riduce il bisogno; il merge tocca record esistenti e merita test dedicati.

---

## TASK 3 — Foto e note nell'avanzamento lavorazioni / timbratura fine giornata
**Priorità: ALTA · Complessità: MEDIA · Rischio: BASSO**

**Obiettivo:** oggi non si possono inserire foto dall'interfaccia di avanzamento. L'operaio deve poter allegare foto e note a fine giornata, nel flusso timbratura di uscita: avanzamento % → foto → note. Le foto devono poi confluire nel PDF (Task 5).

**Macchinari nel TIMBRA OUT (aggiunto 2026-06-10):** nel flusso di uscita, oltre alle lavorazioni in avanzamento, va proposto uno step per registrare i **macchinari utilizzati** in giornata (selezione da `macchinari_pubblici` + ore di utilizzo → insert in `costi_macchinari_commessa`). I responsabili selezionano macchinario e ore ma NON vedono prezzi/costi (viste senza colonne costo, vedi Task 0). Verificare che la policy INSERT (`current_is_admin_or_responsabile()`) copra chi compila; le tariffe le valorizza l'Admin.

**Storage (Supabase Storage):**
- Bucket `foto-lavorazioni`, path `{azienda_id}/{cantiere_id}/{lavorazione_id}/{timestamp}.jpg`.
- Policy storage allineate al multi-tenant: accesso solo se il prefix coincide con `current_azienda_id()`.
- Compressione client-side prima dell'upload (canvas resize max ~1920px, qualità ~0.8) — fondamentale da cantiere con 4G scarso.

**DB:**
```sql
CREATE TABLE foto_avanzamenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  avanzamento_id UUID NOT NULL REFERENCES avanzamenti(id),
  storage_path TEXT NOT NULL,
  nota TEXT,
  caricata_da UUID NOT NULL REFERENCES profiles(id),
  caricata_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Policy RESTRICTIVE su azienda_id
```

**UI / PWA:**
- `<input type="file" accept="image/*" capture="environment" multiple>` per aprire direttamente la fotocamera.
- Upload con coda e retry: se la rete cade la foto resta in attesa (stato visibile) e riparte. V1 senza IndexedDB: stato in memoria + avviso "non chiudere prima del completamento".
- Flusso timbratura uscita esteso: step 1 timbro → step 2 % lavorazioni → step 3 macchinari utilizzati + ore (opzionale, skippabile) → step 4 foto + note (opzionali, skippabili).
- Nel PDF del rapporto (pdf-lib) entrano **thumbnail compresse** per restare sotto il limite allegato email (vedi Task 5).

---

## TASK 4 — Lavorazioni proposte + lavori extra
**Priorità: ALTA · Complessità: MEDIA · Rischio: MEDIO**

**Obiettivo:** l'operaio segna la % delle lavorazioni previste, può proporre lavorazioni nuove (in attesa di verifica Admin per evitare doppioni) e può registrare **lavori extra** non contemplati nelle lavorazioni attribuite al cantiere.

**DB — lavorazioni proposte (colonna `stato` sulla tabella esistente):**
```sql
ALTER TABLE lavorazioni ADD COLUMN stato TEXT NOT NULL DEFAULT 'approvata'
  CHECK (stato IN ('approvata', 'proposta', 'rifiutata'));
ALTER TABLE lavorazioni ADD COLUMN proposta_da UUID REFERENCES profiles(id);
ALTER TABLE lavorazioni ADD COLUMN nota_proposta TEXT;
ALTER TABLE lavorazioni ADD COLUMN approvata_da UUID REFERENCES profiles(id);
ALTER TABLE lavorazioni ADD COLUMN approvata_il TIMESTAMPTZ;
```

**DB — lavori extra sul rapporto:**
```sql
CREATE TABLE rapporto_lavori_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  rapporto_id UUID NOT NULL REFERENCES rapporti_lavoro(id),
  descrizione TEXT NOT NULL,
  ore NUMERIC(5,2),
  note TEXT,
  inserito_da UUID NOT NULL REFERENCES profiles(id),
  inserito_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Policy RESTRICTIVE su azienda_id
-- + trigger lock: nessuna modifica se il rapporto padre è firmato/inviato (vedi Task 1)
```
I lavori extra sono righe libere del rapporto: descrizione + ore + note, **non** legate al catalogo lavorazioni. Compaiono nel PDF in una sezione dedicata "Lavori extra". Dall'Admin, un extra ricorrente può essere "promosso" a lavorazione di catalogo (riusa il flusso proposte).

**Logica anti-doppioni proposte (lato Admin):**
- Pannello "Proposte in attesa" con badge contatore.
- All'approvazione, ricerca fuzzy (`pg_trgm` / `similarity()`) sulle lavorazioni esistenti: l'Admin sceglie "Approva come nuova" o "Unisci a esistente" (avanzamenti ricollegati automaticamente).
- Possibile riuso del pattern import AI lavorazioni: Claude API per match semantici oltre che testuali.

**UI operaio:**
- Schermata avanzamento: pulsante "+ Proponi lavorazione" → nome + nota. La proposta appare subito con badge "In attesa di verifica" e può già ricevere % e foto.
- Sezione rapporto: "+ Lavoro extra" → descrizione, ore, note.

**RLS:** proposte ed extra visibili solo nella stessa `azienda_id`; solo admin può aggiornare `stato` delle proposte.

**Estensioni decise (2026-06-11):**
- **Cantiere senza lavorazioni:** al TIMBRA OUT il wizard si apre comunque con step "aggiungi lavorazioni manualmente" (create come proposte con % subito assegnabile), poi macchinari → foto; step finale opzionale "Crea rapporto di lavoro" (bozza precompilata con cantiere/data/cliente/lavorazioni/operatore).
- **Attività "Cantiere nuovo":** nuova voce nella lista attività per timbrare l'entrata quando il cantiere non esiste ancora in anagrafica. Al TIMBRA OUT il wizard chiede i dati del cantiere (nome, indirizzo, cliente opzionale), crea il cantiere, riassegna la timbratura e genera la bozza di rapporto di lavoro. Da decidere in implementazione: la policy INSERT su cantieri oggi è solo admin → estendere ai responsabili per questo flusso.

---

## TASK 5 — Tasto "Invia": PDF via email a cliente, admin e operaio (Resend)
**Priorità: MEDIA-ALTA · Complessità: MEDIA · Rischio: MEDIO · Dipende da: Task 1, 2, 3**

**Obiettivo:** su un rapporto firmato compare il tasto "Invia". Alla pressione: genera il PDF definitivo e lo invia via email al cliente (dall'anagrafica), all'admin dell'azienda e **in copia all'operaio compilatore** (conferma di consegna + tutela in caso di contestazioni). Stato → `inviato`.

**Prerequisito infrastruttura:** ✅ già completato — dominio `cantivo.it` verificato su Resend, `RESEND_API_KEY` su Vercel. Mittente per i rapporti: `rapporti@cantivo.it`. Testare deliverability con caselle Gmail e Outlook reali prima del go-live.

**Flusso:**
1. Tasto "Invia" visibile solo se `stato = 'firmato'` e il cliente ha un'email in anagrafica (altrimenti prompt per inserirla → aggiorna anagrafica).
2. API route server-side: genera il PDF definitivo con pdf-lib (dati rapporto + lavorazioni con % + lavori extra + foto thumbnail + firma), lo salva su Storage (`rapporti-pdf/{azienda_id}/...`) come **copia immutabile**.
3. Invio via Resend: A: cliente · CC: admin azienda, operaio compilatore. Oggetto: `Rapporto di lavoro — {cantiere} — {data}`.
4. Solo a invio riuscito: `stato = 'inviato'`, `inviato_il = now()`. Se Resend fallisce, lo stato resta `firmato` e il tasto è ripremibile (idempotenza: non duplicare il PDF su Storage — se esiste già, riusarlo).
5. Log invii: tabella `email_log` (`azienda_id`, rapporto_id, destinatari, esito, message_id Resend, timestamp) — utile per contestazioni.

**Attenzione:**
- Peso allegato: target < 5 MB. Se le foto sono tante: PDF con thumbnail + link alle foto originali (URL firmati Supabase con scadenza).
- Il PDF inviato è la **copia legale**: generato una volta, archiviato, mai rigenerato a ogni visualizzazione.

---

## TASK 6 (futuro) — Collaborazioni tra aziende: cantiere condiviso e SAL unico
**Priorità: DA PIANIFICARE · Complessità: ALTA · Rischio: ALTO (deroga controllata al multi-tenant)**

**Scenario:** A2C appalta a NETWISP lavori sul cantiere CASCINA MUGGIANO. Ogni azienda
timbra e registra avanzamenti per conto proprio, ma a fine periodo il SAL del cantiere
deve poter fare **merge** dei dati delle due aziende: un unico SAL di cantiere.

**Requisito:** collegare due (o più) aziende **solo su uno specifico cantiere**, con
visibilità reciproca limitata alle lavorazioni/avanzamenti di quel cantiere — mai
all'intera anagrafica dell'altra azienda.

**Prime linee di design (da validare):**
- Tabella ponte `cantieri_collaborazioni` (`cantiere_id`, `azienda_committente`,
  `azienda_collaboratrice`, `stato` invito: proposta/accettata/revocata, date):
  la collaborazione nasce su invito dell'azienda titolare del cantiere e va
  accettata dall'altra — mai unilaterale.
- RLS: policy ADDITIVE e mirate (mai allargare le RESTRICTIVE esistenti) che
  concedono SELECT sulle lavorazioni/avanzamenti/SAL del SOLO cantiere collegato,
  alle sole aziende con collaborazione `accettata`.
- **Perimetro dati (deciso 2026-06-12):** al committente servono SOLO le
  lavorazioni completate/in avanzamento del subappaltatore (nomi e %).
  Costi, ricavi, tariffe, ore uomo e dati economici del subappaltatore
  restano SEMPRE privati — esclusi dal design fin dall'inizio.
- Il cantiere "fisico" resta di proprietà del committente; l'azienda collaboratrice
  vi timbra tramite il collegamento (da decidere: cantiere condiviso vs cantiere
  speculare collegato).
- SAL di fine periodo: vista/aggregazione che unisce gli avanzamenti delle aziende
  collegate per il cantiere condiviso; export unico (chi lo firma? il committente).
- Punti aperti: chi vede le foto dell'altra azienda; come si gestiscono le
  lavorazioni omonime (merge proposte cross-azienda?); fatturazione separata;
  revoca collaborazione a metà periodo (snapshot dei dati già condivisi?).

**Nota di sicurezza:** è la prima feature che attraversa volutamente il confine
tenant — serve un design review dedicato delle policy prima di scrivere codice,
e test cross-azienda sistematici (2 aziende collegate + 1 terza estranea).

---

## TASK 7 (futuro) — Geolocalizzazione al timbro: cantieri in prossimità
**Priorità: DA PIANIFICARE · Complessità: MEDIA · Rischio: MEDIO-ALTO (privacy/normativa)**

**Idea:** al TIMBRA IN, usare la posizione del telefono per proporre in cima
la lista dei cantieri più vicini.

**Vincoli emersi dall'analisi (2026-06-12):**
- **Normativa (il punto critico):** la posizione del lavoratore è dato personale;
  in Italia il controllo a distanza tocca l'art. 4 dello Statuto dei Lavoratori.
  Design a rischio minimo: posizione letta SOLO al tap, usata SOLO on-device per
  ordinare la lista, MAI salvata né inviata al server; funzione opt-in con
  informativa chiara. Se invece si volesse SALVARE la posizione nel timbro
  (prova di presenza), servono consulenza legale, informativa GDPR aggiornata
  e probabilmente accordo sindacale/autorizzazione — altra storia.
- **Tecnici:** serve aggiungere coordinate ai cantieri (oggi solo indirizzo
  testuale → geocoding in salvataggio cantiere); permesso geolocalizzazione
  della PWA con fallback immediato alla lista normale se negato/timeout;
  precisione GPS variabile in cantiere; il timbro deve restare veloce
  (timeout breve sul fix GPS, mai bloccare il flusso).
