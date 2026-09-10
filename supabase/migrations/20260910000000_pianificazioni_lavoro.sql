-- Calendario condiviso dei lavori schedulati: admin/superadmin/responsabile
-- compilano (cantiere, data, squadra, macchinari da portare), gli operai
-- vedono solo i lavori dove sono in squadra (filtro applicato lato API,
-- non qui: la RLS garantisce solo l'isolamento per azienda).

create table if not exists public.pianificazioni_lavoro (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  cantiere_id uuid not null references public.cantieri(id) on delete cascade,
  data date not null,
  note text not null default '',
  creato_da uuid not null references public.dipendenti(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pianificazioni_lavoro_azienda_data_idx
  on public.pianificazioni_lavoro (azienda_id, data);

alter table public.pianificazioni_lavoro enable row level security;

create policy pianificazioni_lavoro_tenant_isolation on public.pianificazioni_lavoro
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());

-- Squadra assegnata a una pianificazione
create table if not exists public.pianificazioni_squadra (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  pianificazione_id uuid not null references public.pianificazioni_lavoro(id) on delete cascade,
  dipendente_id uuid not null references public.dipendenti(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint pianificazioni_squadra_unique unique (pianificazione_id, dipendente_id)
);

create index if not exists pianificazioni_squadra_dipendente_id_idx
  on public.pianificazioni_squadra (dipendente_id);

alter table public.pianificazioni_squadra enable row level security;

create policy pianificazioni_squadra_tenant_isolation on public.pianificazioni_squadra
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());

-- Macchinari da portare per una pianificazione
create table if not exists public.pianificazioni_macchinari (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  pianificazione_id uuid not null references public.pianificazioni_lavoro(id) on delete cascade,
  macchinario_id uuid not null references public.macchinari(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint pianificazioni_macchinari_unique unique (pianificazione_id, macchinario_id)
);

create index if not exists pianificazioni_macchinari_macchinario_id_idx
  on public.pianificazioni_macchinari (macchinario_id);

alter table public.pianificazioni_macchinari enable row level security;

create policy pianificazioni_macchinari_tenant_isolation on public.pianificazioni_macchinari
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());
