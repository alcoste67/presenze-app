-- Oggi (20261030000003/4/5) ho reintrodotto per errore una whitelist in
-- current_dipendente_ruolo(), che era già stata resa whitelist-free a
-- giugno 2026 (vedi migrations/fix_funzioni_ruolo.sql, cartella separata
-- da supabase/migrations e non controllata prima di oggi). Risultato:
-- lo stesso bug già risolto a giugno si è ripresentato tre volte in un
-- giorno (SUPERADMIN, poi COMMERCIALE, poi UFFICIO) — ogni volta che si
-- aggiunge un ruolo nuovo bisogna ricordarsi di aggiornare questa lista.
--
-- Fix definitivo:
-- 1. current_dipendente_ruolo() torna senza whitelist: ritorna il ruolo
--    che c'è, qualunque esso sia (la validità è già garantita dal CHECK
--    constraint su dipendenti.ruolo). Nessun ruolo futuro potrà più
--    "sparire" da qui per essere stato dimenticato in una lista.
-- 2. current_is_admin_or_responsabile() resta una whitelist esplicita
--    (ADMIN/SUPERADMIN/RESPONSABILE): è giusto che un ruolo elevato sia
--    una scelta deliberata, mai un default.
-- 3. current_is_operatore() diventa "qualunque ruolo riconosciuto che
--    non sia già admin/responsabile" — copre oggi OPERAIO, COMMERCIALE,
--    UFFICIO, e in automatico qualunque ruolo futuro aggiunto, finché
--    non lo si eleva esplicitamente nel punto 2.
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
    public.current_dipendente_ruolo() is not null
    and not public.current_is_admin_or_responsabile(),
    false
  )
$$;
