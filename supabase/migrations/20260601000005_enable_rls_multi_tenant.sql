-- Riattiva policy RESTRICTIVE per isolamento multi-tenant
-- Ora il codice services passa azienda_id esplicito, l'enforcement è sicuro

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
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON public.%I '
      'AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (azienda_id = public.current_azienda_id()) '
      'WITH CHECK (azienda_id = public.current_azienda_id())',
      t, t
    );
  END LOOP;
END $$;
