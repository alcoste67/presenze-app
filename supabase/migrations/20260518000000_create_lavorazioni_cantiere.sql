create table if not exists public.lavorazioni_cantiere (
  id uuid primary key default gen_random_uuid(),
  cantiere_id uuid not null references public.cantieri(id) on delete cascade,
  nome text not null,
  ordine integer not null default 0,
  attiva boolean not null default true,
  percentuale_completamento integer not null default 0,
  created_at timestamptz not null default now(),
  constraint lavorazioni_cantiere_percentuale_check check (
    percentuale_completamento >= 0
    and percentuale_completamento <= 100
  )
);

create index if not exists lavorazioni_cantiere_cantiere_id_idx
  on public.lavorazioni_cantiere (cantiere_id);

create index if not exists lavorazioni_cantiere_ordine_idx
  on public.lavorazioni_cantiere (cantiere_id, ordine);
