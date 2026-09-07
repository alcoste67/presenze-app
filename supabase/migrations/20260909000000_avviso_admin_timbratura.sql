-- Avviso admin (push + mail di backup) quando un dipendente selezionato
-- timbra ENTRATA o USCITA. Spento di default: l'admin lo accende dipendente
-- per dipendente da backoffice.
alter table public.dipendenti
  add column if not exists avvisa_admin_timbratura boolean not null default false;
