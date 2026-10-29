-- current_dipendente_ruolo() non riconosceva il ruolo SUPERADMIN (creato
-- dopo questa funzione): chi ha quel ruolo veniva trattato come utente
-- normale da current_is_admin_or_responsabile(), usata in RLS su più
-- tabelle (checklist_wallbox, rapporti_intervento, costi_macchinari,
-- timbrature...) — vedeva/modificava quindi solo le proprie righe invece
-- di tutte quelle dell'azienda, come un ADMIN. Un SUPERADMIN deve avere
-- almeno gli stessi permessi di un ADMIN.
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
      'OPERATORE'
    )
  limit 1
$$;

create or replace function public.current_is_admin_or_responsabile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_dipendente_ruolo() in (
      'ADMIN',
      'SUPERADMIN',
      'RESPONSABILE'
    ),
    false
  )
$$;
