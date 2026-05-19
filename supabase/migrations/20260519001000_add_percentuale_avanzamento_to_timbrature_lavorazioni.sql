alter table public.timbrature_lavorazioni
  add column if not exists percentuale_avanzamento integer null;

alter table public.timbrature_lavorazioni
  add constraint timbrature_lavorazioni_percentuale_avanzamento_check
  check (
    percentuale_avanzamento is null
    or (
      percentuale_avanzamento >= 0
      and percentuale_avanzamento <= 100
    )
  );
