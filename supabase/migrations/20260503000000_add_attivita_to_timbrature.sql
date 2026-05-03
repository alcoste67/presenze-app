alter table public.timbrature
  alter column cantiere_id drop not null;

alter table public.timbrature
  add column attivita_tipo text null;

alter table public.timbrature
  add constraint timbrature_attivita_tipo_check
  check (
    attivita_tipo is null
    or attivita_tipo in (
      'ACQUISTI',
      'TRASFERTA',
      'MAGAZZINO',
      'UFFICIO',
      'SOPRALLUOGO',
      'ASSISTENZA',
      'VISITA_MEDICA',
      'FORMAZIONE',
      'ALTRO'
    )
  );
