# REGOLE AI — PRESENZE-APP

## Regole Generali

* NON modificare file non richiesti
* NON cambiare naming dominio
* NON introdurre librerie nuove senza richiesta
* NON duplicare logica esistente
* NON creare componenti inutili
* NON usare any in TypeScript

---

# Architettura

* Business logic nei services
* Componenti solo UI
* Query Supabase solo nei services
* Hook dedicati per logica stato
* Evitare logica complessa in page.tsx

---

# TypeScript

* Strict mode compatibile
* Tipizzazione esplicita
* Riutilizzare types centralizzati

---

# Refactor

* Refactor incrementali
* Una responsabilità per modifica
* Mantenere retrocompatibilità
* Evitare modifiche massive

---

# UI

* TailwindCSS
* Componenti semplici e riutilizzabili
* Evitare inline styles

---

# Naming

Dominio italiano:

* timbrature
* cantieri
* entrata
* uscita
* pausa
* rientro

---

# Workflow Operativo

Prima di ogni modifica:

1. analizzare architettura esistente
2. verificare dipendenze
3. minimizzare impatto modifiche

Dopo ogni modifica:

1. verificare TypeScript
2. verificare import
3. verificare compatibilità
