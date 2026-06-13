-- TASK 6c — Snapshot subappaltatore nel SAL periodo (2026-06-13)
-- ============================================================
-- Alla creazione del SAL periodo (freeze) le lavorazioni del
-- subappaltatore (nome + %) vengono CONGELATE in questa tabella, così
-- restano coerenti col resto del documento e finiscono nell'export.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

CREATE TABLE public.sal_freeze_collaborazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freeze_id UUID NOT NULL REFERENCES public.sal_freeze_mensili(id) ON DELETE CASCADE,
  azienda_id UUID NOT NULL,                 -- azienda committente (proprietaria del freeze)
  azienda_collaboratrice_nome TEXT NOT NULL,
  cantiere_collaboratore_nome TEXT NOT NULL,
  lavorazione_nome TEXT NOT NULL,
  percentuale_completamento INTEGER NOT NULL DEFAULT 0,
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sal_freeze_collab_freeze_idx
  ON public.sal_freeze_collaborazioni (freeze_id);

ALTER TABLE public.sal_freeze_collaborazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY sal_freeze_collab_tenant_isolation ON public.sal_freeze_collaborazioni
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- Lettura per admin/responsabile della propria azienda; la scrittura
-- avviene server-side (service role) alla creazione del freeze
CREATE POLICY sal_freeze_collab_select ON public.sal_freeze_collaborazioni
  FOR SELECT TO authenticated
  USING (public.current_is_admin_or_responsabile());

NOTIFY pgrst, 'reload schema';
