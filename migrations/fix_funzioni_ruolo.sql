-- FIX — Funzioni ruolo: SUPERADMIN e OPERAIO esclusi (2026-06-10)
-- ============================================================
-- Due bug in current_dipendente_ruolo() e current_is_operatore():
--
-- 1. current_dipendente_ruolo() filtra ruolo IN ('ADMIN','RESPONSABILE',
--    'OPERATORE'): per SUPERADMIN (e OPERAIO, UFFICIO) restituisce NULL,
--    quindi current_is_admin() resta false → 403 anche dopo il fix
--    precedente.
-- 2. Il ruolo reale a DB si chiama 'OPERAIO' (vedi dipendenti_ruolo_check),
--    non 'OPERATORE': current_is_operatore() non è MAI vera. Finché
--    esisteva la policy pubblica sui cantieri non si vedeva; rimossa
--    quella (fix_policy_anon.sql), gli operai non vedrebbero più i
--    cantieri attivi.
--
-- Eseguire su DEV, test, poi PROD.

-- 1. Ruolo corrente senza whitelist: restituisce il ruolo qualunque sia
CREATE OR REPLACE FUNCTION public.current_dipendente_ruolo()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select d.ruolo
  from public.dipendenti d
  where d.auth_user_id = auth.uid()
    and d.attivo = true
  limit 1
$$;

-- 2. Operatore = OPERAIO (mantengo anche 'OPERATORE' per compatibilità)
CREATE OR REPLACE FUNCTION public.current_is_operatore()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(
    public.current_dipendente_ruolo() in ('OPERAIO', 'OPERATORE'),
    false
  )
$$;

-- ============================================================
-- TEST:
--   A) SUPERADMIN: crea un macchinario → ok (e l'elenco si popola)
--   B) OPERAIO: nella pagina timbrature vede i cantieri attivi della
--      propria azienda
--   C) RESPONSABILE/ADMIN: invariati
