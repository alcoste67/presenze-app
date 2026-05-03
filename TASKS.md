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
