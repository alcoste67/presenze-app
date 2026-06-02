-- Rollback policy RESTRICTIVE: enforcement RLS multi-tenant rimandato a dopo refactor codice services
-- Manteniamo: schema azienda_id, funzione current_azienda_id(), trigger auto-popolazione

DO $$
DECLARE
  t TEXT;
  tabelle TEXT[] := ARRAY[
    'dipendenti', 'cantieri', 'macchinari', 'lavorazioni_cantiere',
    'timbrature', 'timbrature_lavorazioni',
    'rapporti_intervento', 'rapporti_intervento_foto', 'rapporti_intervento_lavorazioni',
    'rapporti_intervento_materiali', 'rapporti_intervento_operatori',
    'sal_freeze_mensili', 'sal_freeze_lavorazioni', 'sal_freeze_foto', 'sal_freeze_macchinari',
    'sal_lavorazioni_foto', 'costi_macchinari_commessa'
  ];
BEGIN
  FOREACH t IN ARRAY tabelle LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I', t, t);
  END LOOP;
END $$;

-- Backfill manuale per Andrea Costenaro che è stato creato durante test con azienda_id NULL
UPDATE public.dipendenti
SET azienda_id = '00000000-0000-0000-0000-000000000001'
WHERE azienda_id IS NULL;
