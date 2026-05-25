create table if not exists public.rapporti_intervento_operatori (
  id uuid primary key default gen_random_uuid(),
  rapporto_intervento_id uuid not null references public.rapporti_intervento(id) on delete cascade,
  dipendente_id uuid null references public.dipendenti(id) on delete set null,
  nome_snapshot text not null,
  email_snapshot text null,
  ore_minuti integer not null default 0,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  constraint rapporti_intervento_operatori_ore_check
    check (ore_minuti >= 0)
);

create index if not exists rapporti_intervento_operatori_rapporto_idx
  on public.rapporti_intervento_operatori (rapporto_intervento_id);

create index if not exists rapporti_intervento_operatori_dipendente_idx
  on public.rapporti_intervento_operatori (dipendente_id);
