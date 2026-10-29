-- Il ruolo COMMERCIALE (introdotto dopo questi helper, vedi
-- 20261029000000_ruolo_commerciale.sql) non era riconosciuto da
-- current_dipendente_ruolo(): un dipendente COMMERCIALE risultava
-- "nessun ruolo" per tutte le RLS che si basano su questa funzione,
-- incluse policy SELECT su tabelle come cantieri e lavorazioni_cantiere
-- che richiedono current_is_operatore() — quindi liste vuote, non solo
-- un problema di isolamento ma di funzionalità.
--
-- Scelta: COMMERCIALE viene trattato a livello base come un OPERATORE
-- (vede cantieri/lavorazioni attivi), NON come ADMIN/SUPERADMIN — non ha
-- oggi nessun bisogno applicativo di vedere/approvare dati di altri
-- dipendenti. Da rivedere se in futuro servirà un livello diverso.
--
-- CREATE OR REPLACE: le policy esistenti che richiamano queste funzioni
-- per nome non vanno ricreate, usano subito il nuovo comportamento.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

create or replace function public.current_dipendente_ruolo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select d.ruolo
  from public.dipendenti d
  where d.auth_user_id = auth.uid()
    and d.attivo = true
    and d.ruolo in (
      'ADMIN',
      'SUPERADMIN',
      'RESPONSABILE',
      'OPERATORE',
      'COMMERCIALE'
    )
  limit 1
$$;

create or replace function public.current_is_operatore()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_dipendente_ruolo() in (
      'OPERATORE',
      'COMMERCIALE'
    ),
    false
  )
$$;
