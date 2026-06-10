-- TASK 0.5 — Tipi macchinario gestibili per azienda (2026-06-10)
-- ============================================================
-- I tipi macchinario erano una lista fissa (CHECK constraint + costanti
-- nel codice). Diventano una tabella per-azienda gestita dall'Admin.
-- La colonna testuale `tipo` resta come snapshot/compatibilità.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Tabella tipi
CREATE TABLE public.tipi_macchinario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  nome TEXT NOT NULL,
  attivo BOOLEAN NOT NULL DEFAULT true,
  creato_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (azienda_id, nome)
);

ALTER TABLE public.tipi_macchinario ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipi_macchinario_tenant_isolation ON public.tipi_macchinario
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY tipi_macchinario_select ON public.tipi_macchinario
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tipi_macchinario_insert_admin ON public.tipi_macchinario
  FOR INSERT TO authenticated WITH CHECK (public.current_is_admin());

CREATE POLICY tipi_macchinario_update_admin ON public.tipi_macchinario
  FOR UPDATE TO authenticated
  USING (public.current_is_admin()) WITH CHECK (public.current_is_admin());

CREATE POLICY tipi_macchinario_delete_admin ON public.tipi_macchinario
  FOR DELETE TO authenticated USING (public.current_is_admin());

-- 2. Seed: i 5 tipi storici per ogni azienda esistente
INSERT INTO public.tipi_macchinario (azienda_id, nome)
SELECT a.id, t.nome
FROM public.aziende a
CROSS JOIN (VALUES ('Scavatore'), ('PLE'), ('Autogru'), ('Carotaggio'), ('Altro')) AS t(nome)
ON CONFLICT (azienda_id, nome) DO NOTHING;

-- 3. macchinari: aggancio alla nuova tabella + backfill
ALTER TABLE public.macchinari
  ADD COLUMN tipo_id UUID REFERENCES public.tipi_macchinario(id);

UPDATE public.macchinari m
SET tipo_id = t.id
FROM public.tipi_macchinario t
WHERE t.azienda_id = m.azienda_id
  AND t.nome = CASE m.tipo
    WHEN 'SCAVATORE'  THEN 'Scavatore'
    WHEN 'PLE'        THEN 'PLE'
    WHEN 'AUTOGRU'    THEN 'Autogru'
    WHEN 'CAROTAGGIO' THEN 'Carotaggio'
    ELSE 'Altro'
  END;

-- 4. Rimozione CHECK: il tipo testuale diventa libero (snapshot)
ALTER TABLE public.macchinari DROP CONSTRAINT IF EXISTS macchinari_tipo_check;
ALTER TABLE public.costi_macchinari_commessa DROP CONSTRAINT IF EXISTS costi_macchinari_commessa_tipo_check;

-- 5. Vista pubblica: espone anche tipo_id e tipo_nome (resta SECURITY
--    DEFINER con filtro tenant esplicito — deroga documentata Task 0)
CREATE OR REPLACE VIEW public.macchinari_pubblici AS
 SELECT m.id,
    m.nome,
    m.tipo,
    m.descrizione,
    m.attivo,
    m.tipo_id,
    t.nome AS tipo_nome
   FROM public.macchinari m
   LEFT JOIN public.tipi_macchinario t ON t.id = m.tipo_id
  WHERE m.azienda_id = public.current_azienda_id();

-- ============================================================
-- TEST:
--   A) Admin: SELECT * FROM tipi_macchinario → 5 tipi della propria azienda
--   B) Admin: i macchinari esistenti hanno tipo_id valorizzato
--   C) Admin azienda 1 non vede i tipi dell'azienda 2
--   D) Responsabile: SELECT su tipi_macchinario ok, INSERT negato
