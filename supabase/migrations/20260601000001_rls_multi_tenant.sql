-- RLS multi-tenant: aggiunge filtro azienda_id alle 17 tabelle
-- Strategia: policy RESTRICTIVE che si AND-a alle policies esistenti

-- 1. Funzione che ritorna azienda_id dell'utente loggato
CREATE OR REPLACE FUNCTION public.current_azienda_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT azienda_id
  FROM public.dipendenti
  WHERE auth_user_id = auth.uid()
    AND attivo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_azienda_id() TO authenticated;

-- 2. RESTRICTIVE policies per ogni tabella
-- Pattern: azienda_id deve coincidere con current_azienda_id()

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
