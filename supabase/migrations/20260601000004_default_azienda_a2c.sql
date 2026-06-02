-- DEFAULT azienda_id su A2C SISTEMI per nuovi record da service_role
-- Soluzione temporanea fino a refactor codice multi-tenant

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
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN azienda_id SET DEFAULT %L',
      t, '00000000-0000-0000-0000-000000000001'
    );
  END LOOP;
END $$;

-- Backfill orfani
UPDATE public.dipendenti SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.cantieri SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.macchinari SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.lavorazioni_cantiere SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.timbrature SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.timbrature_lavorazioni SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_foto SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_lavorazioni SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_materiali SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_operatori SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_mensili SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_lavorazioni SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_foto SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_macchinari SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_lavorazioni_foto SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.costi_macchinari_commessa SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
