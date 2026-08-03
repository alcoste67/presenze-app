-- TASK 16 — Indici sulle foreign key non indicizzate (2026-06-16)
-- ============================================================
-- Risolve l'advisor "unindexed_foreign_keys" (INFO, performance): ogni FK
-- senza indice di copertura può rallentare join, cancellazioni a cascata e
-- le policy RLS che filtrano su azienda_id/cantiere_id ecc.
-- Solo CREATE INDEX IF NOT EXISTS → idempotente, nessuna modifica ai dati.
-- Le tabelle sono piccole: il lock di creazione è trascurabile.
--
-- Eseguire su DEV (mkfedjazibcmstkjxkfm) e su PROD (skdtczhvxvawwjanciss).

CREATE INDEX IF NOT EXISTS idx_cantieri_cliente_id ON public.cantieri (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cantieri_collaborazioni_cantiere_collaboratore_id ON public.cantieri_collaborazioni (cantiere_collaboratore_id);
CREATE INDEX IF NOT EXISTS idx_cantieri_collaborazioni_cantiere_committente_id ON public.cantieri_collaborazioni (cantiere_committente_id);
CREATE INDEX IF NOT EXISTS idx_contratti_cantiere_azienda_id ON public.contratti_cantiere (azienda_id);
CREATE INDEX IF NOT EXISTS idx_costi_macchinari_commessa_azienda_id ON public.costi_macchinari_commessa (azienda_id);
CREATE INDEX IF NOT EXISTS idx_costi_macchinari_commessa_created_by ON public.costi_macchinari_commessa (created_by);
CREATE INDEX IF NOT EXISTS idx_costi_materiali_cantiere_azienda_id ON public.costi_materiali_cantiere (azienda_id);
CREATE INDEX IF NOT EXISTS idx_costi_materiali_cantiere_cantiere_id ON public.costi_materiali_cantiere (cantiere_id);
CREATE INDEX IF NOT EXISTS idx_email_log_rapporto_intervento_id ON public.email_log (rapporto_intervento_id);
CREATE INDEX IF NOT EXISTS idx_lavorazioni_cantiere_subappaltata_a_collaborazione_id ON public.lavorazioni_cantiere (subappaltata_a_collaborazione_id);
CREATE INDEX IF NOT EXISTS idx_macchinari_tipo_id ON public.macchinari (tipo_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_cantiere_id ON public.rapporti_intervento (cantiere_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_cliente_id ON public.rapporti_intervento (cliente_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_created_by ON public.rapporti_intervento (created_by);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_extra_rapporto_intervento_id ON public.rapporti_intervento_extra (rapporto_intervento_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_foto_azienda_id ON public.rapporti_intervento_foto (azienda_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_lavorazioni_azienda_id ON public.rapporti_intervento_lavorazioni (azienda_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_lavorazioni_lavorazione_id ON public.rapporti_intervento_lavorazioni (lavorazione_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_lavorazioni_rapporto_intervento_id ON public.rapporti_intervento_lavorazioni (rapporto_intervento_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_materiali_azienda_id ON public.rapporti_intervento_materiali (azienda_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_operatori_azienda_id ON public.rapporti_intervento_operatori (azienda_id);
CREATE INDEX IF NOT EXISTS idx_sal_freeze_foto_azienda_id ON public.sal_freeze_foto (azienda_id);
CREATE INDEX IF NOT EXISTS idx_sal_freeze_foto_lavorazione_id ON public.sal_freeze_foto (lavorazione_id);
CREATE INDEX IF NOT EXISTS idx_sal_freeze_foto_sal_foto_id ON public.sal_freeze_foto (sal_foto_id);
CREATE INDEX IF NOT EXISTS idx_sal_freeze_lavorazioni_azienda_id ON public.sal_freeze_lavorazioni (azienda_id);
CREATE INDEX IF NOT EXISTS idx_sal_freeze_macchinari_azienda_id ON public.sal_freeze_macchinari (azienda_id);
CREATE INDEX IF NOT EXISTS idx_sal_lavorazioni_foto_azienda_id ON public.sal_lavorazioni_foto (azienda_id);
CREATE INDEX IF NOT EXISTS idx_sal_lavorazioni_foto_created_by ON public.sal_lavorazioni_foto (created_by);
CREATE INDEX IF NOT EXISTS idx_sal_lavorazioni_foto_timbratura_id ON public.sal_lavorazioni_foto (timbratura_id);
CREATE INDEX IF NOT EXISTS idx_timbrature_cantiere_id ON public.timbrature (cantiere_id);
CREATE INDEX IF NOT EXISTS idx_timbrature_lavorazioni_azienda_id ON public.timbrature_lavorazioni (azienda_id);
CREATE INDEX IF NOT EXISTS idx_timbrature_user_id ON public.timbrature (user_id);

-- ============================================================
-- NOTA: gli advisor "unused_index" (indici mai usati) NON vanno toccati:
-- molti diventeranno usati col tempo (o sono questi appena creati). Gli
-- alert "security" restano quelli già valutati e accettati (viste macchinari
-- SECURITY DEFINER = deroga; funzioni helper RLS; pg_trgm; leaked_password
-- N/A con login OTP) → marcarli "Ignore" nell'Advisor.
NOTIFY pgrst, 'reload schema';
