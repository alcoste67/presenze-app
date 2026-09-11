-- Permette di annullare una richiesta ferie/permesso (in attesa o già
-- approvata) se il dipendente o l'admin si accorgono di un errore.

alter table public.richieste_assenza
  add column if not exists annullata_da uuid references public.dipendenti(id);

alter table public.richieste_assenza
  add column if not exists annullata_il timestamptz;

alter table public.richieste_assenza
  drop constraint if exists richieste_assenza_stato_check;

alter table public.richieste_assenza
  add constraint richieste_assenza_stato_check
  check (
    stato in ('IN_ATTESA', 'APPROVATA', 'RIFIUTATA', 'ANNULLATA')
  );
