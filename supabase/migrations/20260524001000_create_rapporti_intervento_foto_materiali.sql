create table if not exists public.rapporti_intervento_foto (
  id uuid primary key default gen_random_uuid(),
  rapporto_intervento_id uuid not null references public.rapporti_intervento(id) on delete cascade,
  immagine_data_url text not null,
  descrizione text not null default '',
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rapporti_intervento_materiali (
  id uuid primary key default gen_random_uuid(),
  rapporto_intervento_id uuid not null references public.rapporti_intervento(id) on delete cascade,
  descrizione text not null,
  quantita numeric not null,
  unita_misura text not null,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  constraint rapporti_intervento_materiali_quantita_check
    check (quantita >= 0)
);

create index if not exists rapporti_intervento_foto_rapporto_idx
  on public.rapporti_intervento_foto (rapporto_intervento_id);

create index if not exists rapporti_intervento_materiali_rapporto_idx
  on public.rapporti_intervento_materiali (rapporto_intervento_id);
