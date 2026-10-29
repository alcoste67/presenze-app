-- La vista costi_macchinari_pubblici è stata creata senza security_invoker:
-- di default una vista esegue con i privilegi di chi l'ha creata (la
-- migration, eseguita come owner), quindi bypassa la RLS RESTRICTIVE su
-- costi_macchinari_commessa. Con grant select "to authenticated" aperto a
-- tutti, qualunque utente autenticato di QUALSIASI azienda che conosca un
-- cantiere_id può leggere i costi macchinari di cantieri di altre aziende.
-- Fix: forzare la vista a eseguire con i privilegi di chi la interroga, così
-- la RLS sulla tabella sottostante torna ad applicarsi normalmente.
ALTER VIEW public.costi_macchinari_pubblici SET (security_invoker = true);
