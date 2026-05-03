# PRESENZE-APP — Architettura Progetto

## Stack Tecnologico

* Next.js (App Router)
* TypeScript
* Supabase
* TailwindCSS

---

# Obiettivo Progetto

Applicazione gestione presenze e timbrature per cantieri.

Funzionalità principali:

* timbratura entrata/uscita
* gestione pause
* associazione cantiere
* storico timbrature
* automazioni future SAL
* workflow operativo cantieri

---

# Struttura Cartelle

```txt
app/
components/
services/
lib/
types/
constants/
```

## Responsabilità

### app/

Routing e pagine Next.js.

### components/

Componenti UI riutilizzabili.
NON devono contenere business logic complessa.

### services/

Business logic applicativa.

Esempi:

* calcolo stato
* validazione sequenze
* creazione timbrature
* query Supabase

### lib/

Configurazioni condivise.

### types/

Tipi TypeScript centralizzati.

### constants/

Costanti dominio applicativo.

---

# Dominio Timbrature

## Tipi Timbratura

* ENTRATA
* PAUSA
* RIENTRO
* USCITA

## Stati Utente

* FUORI
* DENTRO
* IN_PAUSA

---

# Sequenze Valide

## Stato FUORI

Consentito:

* ENTRATA

## Stato DENTRO

Consentito:

* PAUSA
* USCITA

## Stato IN_PAUSA

Consentito:

* RIENTRO

---

# Regole Architetturali

* Business logic nei services
* Componenti solo UI
* Nessuna query Supabase direttamente nei componenti
* Tipizzazione TypeScript obbligatoria
* Naming coerente dominio italiano
* Evitare logica complessa dentro page.tsx
* Preferire funzioni pure
* Evitare duplicazioni

---

# Stato Attuale

## Completato

* refactor struttura cartelle
* standard dominio timbrature
* StatoBadge
* loadCantieri
* calcolaStato
* creaTimbratura
* loadUltimaTimbratura
* stabilizzazione page.tsx

## Prossimi Step

1. validaSequenzaTimbratura
2. estrazione PulsantiTimbratura
3. estrazione SelectCantiere
4. hook useTimbrature
5. storico timbrature
6. geolocalizzazione cantieri