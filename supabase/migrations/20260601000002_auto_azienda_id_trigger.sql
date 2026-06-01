-- Trigger auto-popola azienda_id su INSERT da current_azienda_id()
-- Garantisce che app esistente continui a funzionare senza modifiche

CREATE OR REPLACE FUNCTION public.set_azienda_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.azienda_id IS NULL THEN
    NEW.azienda_id := public.current_azienda_id();
  END IF;
  RETURN NEW;
END;
$$;

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
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_azienda_id ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_azienda_id '
      'BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_azienda_id_on_insert()',
      t, t
    );
  END LOOP;
END $$;
