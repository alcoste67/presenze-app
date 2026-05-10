<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PRESENZE-APP — Regole Architetturali

## Stack
- Next.js
- React
- TypeScript strict
- TailwindCSS
- Supabase

## Architettura
- services
- hooks
- components
- constants
- types
- supabase/migrations

## Dominio

### STATI
- FUORI
- DENTRO
- IN_PAUSA

### TIMBRATURE
- ENTRATA
- PAUSA
- RIENTRO
- USCITA

### ATTIVITA
- ACQUISTI
- TRASFERTA
- MAGAZZINO
- UFFICIO
- SOPRALLUOGO
- ASSISTENZA
- VISITA_MEDICA
- FORMAZIONE
- ALTRO

## Regole IMPORTANTI
- NON usare stringhe hardcoded
- usare sempre constants centralizzati
- validazioni UI separate dai services
- loading gestito SOLO da useTimbrature
- query Supabase solo nei services
- NO overengineering
- NO mega refactor
- modifiche piccole e incrementali
- mantenere TypeScript strict

## Workflow
1. analizzare prima di modificare
2. proporre piano minimo
3. modificare solo scope approvato
4. spiegare impatto architetturale
5. evitare modifiche premature

## Stato attuale stabilizzato
- supporto ATTIVITA
- autocomplete cantieri
- storico affidabile
- calcolo ore base
- workflow ENTRATA/PAUSA/RIENTRO/USCITA coerente

## Verifiche obbligatorie
Eseguire sempre:
- npm run lint
- npx tsc --noEmit --incremental false