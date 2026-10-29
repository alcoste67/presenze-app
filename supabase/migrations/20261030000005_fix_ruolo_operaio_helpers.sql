-- current_dipendente_ruolo()/current_is_operatore() controllavano il
-- ruolo 'OPERATORE', valore mai esistito in dipendenti.ruolo (il ruolo
-- vero, fin dalla prima migration, è 'OPERAIO' — refuso introdotto in
-- 20260525001000_add_rls_policies_secure.sql e mai corretto).
--
-- Conseguenza concreta, confermata in produzione: un dipendente OPERAIO
-- non risultava "riconosciuto" da current_dipendente_ruolo() e
-- current_is_operatore() era sempre false per lui, quindi le policy
-- SELECT su cantieri/lavorazioni_cantiere (che richiedono
-- current_is_admin_or_responsabile() OR current_is_operatore()) non
-- restituivano nessuna riga — lista cantieri vuota nella schermata di
-- timbratura, "Nessun cantiere trovato".
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
      'OPERAIO',
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
      'OPERAIO',
      'COMMERCIALE'
    ),
    false
  )
$$;
