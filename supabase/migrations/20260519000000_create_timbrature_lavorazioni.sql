create table if not exists public.timbrature_lavorazioni (
  id uuid primary key default gen_random_uuid(),
  timbratura_id uuid not null references public.timbrature(id) on delete cascade,
  lavorazione_id uuid not null references public.lavorazioni_cantiere(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint timbrature_lavorazioni_timbratura_lavorazione_unique
    unique (timbratura_id, lavorazione_id)
);

create index if not exists timbrature_lavorazioni_timbratura_id_idx
  on public.timbrature_lavorazioni (timbratura_id);

create index if not exists timbrature_lavorazioni_lavorazione_id_idx
  on public.timbrature_lavorazioni (lavorazione_id);
