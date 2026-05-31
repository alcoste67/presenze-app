# TASKS.md

## PROGETTO

PRESENZE-APP

Applicazione gestione presenze operai con:

* timbrature operative
* gestione cantieri
* attività generiche
* autenticazione Supabase
* architettura modulare compatibile AI/Codex

---

# ONDATE DI LAVORO

## ✅ Ondata 1 — Refactor grafico (COMPLETO)

Riscrittura UI 13 pagine backoffice con design system moderno.

* ✅ Design system components (Avatar, Badge, Button, Card, Input, Select, Modal, Toast, etc.)
* ✅ app/backoffice/sal/page.tsx (764 righe)
* ✅ app/backoffice/sal-freeze/page.tsx (642 righe)
* ✅ app/backoffice/cantieri/page.tsx (547 righe)
* ✅ app/backoffice/lavorazioni/page.tsx (756 righe)
* ✅ app/backoffice/presenze/page.tsx (823 righe)
* ✅ app/backoffice/macchinari/page.tsx (624 righe)
* ✅ app/backoffice/rapporti-intervento/page.tsx (587 righe)
* ✅ app/backoffice/produttivita/page.tsx (492 righe)
* ✅ app/backoffice/commessa/page.tsx (456 righe)
* ✅ app/backoffice/dipendenti/page.tsx (764 righe)
* ✅ app/backoffice/costi-macchinari/page.tsx (823 righe)
* ✅ app/backoffice/libro-presenze/page.tsx (619 righe)

**Impatto**: 0 errori lint, 0 errori TypeScript, UI moderna, toast system.

---

## ✅ Ondata 2 — Centralizzazione utility (COMPLETO)

Eliminazione 63 definizioni duplicate di 4 utility critiche.

* ✅ B2.1: `isRecord` (23 duplicate → `lib/typeGuards.ts`)
* ✅ B2.2: `getMessaggioErrore` (22 duplicate → `lib/errors.ts`)
* ✅ B2.3: `HTTP_STATUS` (18 duplicate const → `constants/api.ts`)
* ✅ B2.4: `estraiBearerToken` (9 duplicate → `lib/auth.ts`)

**Files modificati**: 68 file (23 API routes + 18 backoffice pages + 27 services/components).
**Impatto**: -570 righe duplicate, 0 errori, query validation consolidata.

---

## ✅ Step B3.1 — Ottimizzazione query timbrature (VERIFICATO)

Audit su `services/timbrature/creaTimbratura.ts`.

**Conclusione**: Già ottimizzato — nessun double-fetch interno.
* FETCH 1: `loadUltimaTimbratura()` per validazione PRE-INSERT (necessario)
* FETCH 2: INSERT + `.select().single()` per creazione e return (necessario)
* Nessuna ridondanza.

---

# PENDING

## P1: Ondata 2 incompleto — Uniformare campo errore API

**Problema**: Payload API usano 3 nomi diversi per errori:
* `errore` (nostro standard legacy)
* `error` (standard REST)
* `errorMessage` (variante)

**Scope**: 
* Identificare e catalogare tutti gli endpoint che ritornano errori
* Standardizzare su UN SOLO nome (proposta: `error`)
* Aggiornare `getMessaggioErroreApi()` per normalizzare
* Update migrazioni DB se necessario

**Owner**: TBD  
**Timeline**: Dopo ondata 2 (dipendenza bassa)

---

## P2: Architettura multi-tenant preventiva

**Problema**: App sarà multi-tenant (più aziende su una istanza).

**Scope**:
* Aggiungere colonna `azienda_id` (UUID FK, nullable per now)
* Aggiungere RLS policies per filtrare per azienda_id
* Verificare che nessun service esponga dati cross-tenant
* Schema migration pronta, non deploy yet

**Owner**: TBD  
**Timeline**: Prima di primo cliente multi-tenant  
**Note**: RLS già parziale, serve solo completamento

---

## P3: Validazione mercato 60 giorni

**Problema**: Bisogna verificare se un cantiere è "attivo nel mercato" (ultimizia timbrature < 60 giorni).

**Scope**:
* Service `services/cantieri/validaCantiereAttivo.ts`
* Logica: `max(timbrature.created_at) > now() - 60 giorni`
* UI badge su cantieri inattivi
* Considerare archivio soft-delete vs hard-delete

**Owner**: Alex (proposta)  
**Timeline**: Q2 2026  
**Note**: Serve per pulizia UI (non mostrare cantieri morti)

---

## P4: Audit funzionale SAL period PDF

**Problema noto**: Bug Codex su generazione PDF SAL, possibile issue con:
* Aggregazione oreUomo su period
* Join cantiere/lavorazioni
* Formattazione importi

**Scope**:
* Riprodurre bug specifico (qual è il PDF result atteso?)
* Verificare logica aggregazione in `services/sal/loadSalCantiere.ts`
* Controllare PDF template se formula è corretta
* Implementare fix minimo

**Owner**: TBD  
**Timeline**: Quando issue viene segnalata in produzione  
**Blocka**: Niente (non critical path)  
**Note**: Attendere segnalazione utente con caso reale

---

# STATO ATTUALE PROGETTO

## STACK

* Next.js App Router
* React
* TypeScript strict
* TailwindCSS
* Supabase
* struttura modulare services/hooks/components/constants/types

---

# ARCHITETTURA ATTUALE

## Cartelle principali

```txt
app/
components/
hooks/
services/
types/
constants/
lib/
supabase/migrations/
```

---

# DOMINIO ATTUALE

## STATI

```txt
FUORI
DENTRO
IN_PAUSA
```

Centralizzati in:

```txt
constants/stati.ts
```

---

## TIMBRATURE

```txt
ENTRATA
PAUSA
RIENTRO
USCITA
```

Centralizzate in:

```txt
constants/stati.ts
```

---

## ATTIVITA

Dominio introdotto ma NON ancora collegato alla UI.

Attività disponibili:

```txt
ACQUISTI
TRASFERTA
MAGAZZINO
UFFICIO
SOPRALLUOGO
ASSISTENZA
VISITA_MEDICA
FORMAZIONE
ALTRO
```

Centralizzate in:

```txt
constants/attivita.ts
```

Tipo:

```txt
types/attivita.ts
```

---

# REGOLE DOMINIO IMPORTANTI

## Sequenza valida

```txt
FUORI -> ENTRATA
DENTRO -> PAUSA / USCITA
IN_PAUSA -> RIENTRO
```

Validazione centralizzata in:

```txt
services/timbrature/validaSequenzaTimbratura.ts
```

---

## ATTENZIONE

NON usare hardcoded tipo:

```txt
"FUORI"
"DENTRO"
"IN_PAUSA"
```

Usare SEMPRE:

```txt
STATI.*
TIMBRATURE.*
ATTIVITA.*
```

---

# STRUTTURA ATTUALE TIMBRATURE

## useTimbrature

Hook introdotto:

```txt
hooks/useTimbrature.ts
```

Responsabilità:

* loading timbrature
* handleTimbratura
* refreshUltimaTimbratura
* statoAttuale
* orchestration async

NON deve gestire:

* validazioni UI
* alert
* logica visuale

---

## VALIDAZIONI

Separazione IMPORTANTISSIMA:

### UI validation

gestita in:

```txt
app/page.tsx
```

Esempio:

* cantiere non selezionato
* alert utente

---

### Business validation

gestita in:

```txt
services/
```

Esempio:

* sequenza timbrature

---

### Workflow/loading

gestito in:

```txt
hooks/useTimbrature.ts
```

---

# AUTH

Auth Supabase minimale funzionante.

Supportato:

* magic link
* session persistence
* logout

Logout implementato direttamente in:

```txt
app/page.tsx
```

NON esiste ancora:

* useAuth
* auth service dedicato
* device recognition

---

# COMPONENTI ESTRATTI

## Presenti

```txt
components/timbrature/StatoBadge.tsx
components/timbrature/PulsantiTimbratura.tsx
components/cantieri/SelectCantiere.tsx
```

---

# MIGRAZIONI DATABASE

Cartella introdotta:

```txt
supabase/migrations/
```

Migration presente:

```txt
20260503000000_add_attivita_to_timbrature.sql
```

La migration:

* rende nullable cantiere_id
* aggiunge attivita_tipo
* aggiunge check constraint DB

---

# DATABASE ATTUALE

## timbrature

Campi rilevanti:

```txt
user_id
cantiere_id nullable
tipo
attivita_tipo nullable
created_at
timestamp
```

---

# DECISIONI DOMINIO IMPORTANTI

## CAMBIO CANTIERE

NON implementato ancora.

Decisione architetturale presa:

```txt
CAMBIO_CANTIERE NON sarà uno stato.
Sarà eventualmente un evento.
```

Gli stati devono restare:

```txt
FUORI
DENTRO
IN_PAUSA
```

---

## ATTIVITA GENERICHE

Supporto introdotto a livello dominio/database.

NON ancora implementato:

* UI
* workflow
* validazioni frontend
* storico

---

## DESCRIZIONE LIBERA ATTIVITA

NON implementata volutamente.

Per ora:

* solo enum ATTIVITA
* evitare testo libero prematuro

Motivo:

* evitare caos reporting
* evitare dati sporchi
* evitare duplicati semantici

---

# BUG IMPORTANTI GIÀ RISOLTI

## setLoading duplicato

RISOLTO.

Problema:

* ownership loading duplicata tra page.tsx e hook.

Regola definitiva:

```txt
loadingTimbratura è gestito SOLO dal hook.
```

---

## Runtime Error su validazioni UI

RISOLTO.

NON usare:

```ts
throw new Error(...)
```

per:

* validazioni form
* campi mancanti
* UX normale

Usare:

* alert
* return anticipati in UI

---

# STORICO

Pagina esistente ma NON ancora affidabile:

```txt
app/storico/page.tsx
```

Da rifare progressivamente.

Problemi noti:

* dominio vecchio
* query legacy
* aggregazioni incomplete

NON prioritario adesso.

---

# PRIORITÀ FUTURE

## PRIORITÀ ALTA

### 1

UI supporto ATTIVITA generiche

Obiettivo:

* cantiere opzionale
* selezione ATTIVITA alternativa

---

### 2

Validazione:

```txt
cantiere_id OR attivita_tipo
```

Da implementare:

* frontend
* services
* DB constraint finale

---

### 3

Autocomplete ricerca cantieri

Necessario per:

* molti cantieri
* UX operativa reale

---

## PRIORITÀ MEDIA

### Storico serio

Con:

* timeline
* ore lavorate
* segmentazione
* aggregazioni corrette

---

### Cambio cantiere

Da progettare PRIMA dell’implementazione.

NON improvvisare.

---

## PRIORITÀ FUTURA

### Login device-aware

Idea approvata:

* primo login via magic link
* device trusted
* login automatico successivo
* nuovo magic link solo su nuovo device

NON implementare ora.

---

# REGOLE OPERATIVE CODEX

## IMPORTANTISSIMO

* modifiche piccole
* refactor incrementali
* NO mega rewrite
* NO overengineering
* NO nuove tabelle premature
* mantenere TypeScript strict
* eseguire sempre npm run lint

---

# WORKFLOW CONSIGLIATO CON CODEX

1. leggere README_ARCHITETTURA.md
2. leggere TASKS.md
3. leggere REGOLE_AI.md
4. analizzare stato attuale
5. proporre piano minimo
6. implementare modifiche piccole
7. eseguire lint
8. spiegare modifiche

---

# FILOSOFIA PROGETTO

Questo NON è:

* un prototipo UI
* una demo AI-generated

Questo è:

* un gestionale operativo reale
* modellato sui workflow veri degli operai

Le decisioni dominio hanno priorità rispetto alla velocità di coding.

Codex implementa.
L’umano decide il dominio.
