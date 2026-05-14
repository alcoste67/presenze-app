alter table public.dipendenti
  add column if not exists tipo_conteggio_ore text not null default 'REALE';

alter table public.dipendenti
  drop constraint if exists dipendenti_tipo_conteggio_ore_check;

alter table public.dipendenti
  add constraint dipendenti_tipo_conteggio_ore_check
  check (
    tipo_conteggio_ore in (
      'REALE',
      'GIORNATA_FORFAIT_8H'
    )
  );
