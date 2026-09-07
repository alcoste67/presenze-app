-- Push subscriptions per i promemoria di timbratura (Web Push standard,
-- iOS 16.4+ PWA installata e Android Chrome).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  dipendente_id uuid not null references public.dipendenti(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_dipendente_id_idx
  on public.push_subscriptions (dipendente_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_tenant_isolation on public.push_subscriptions
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());

-- Traccia le autocorrezioni di timbratura fatte dal dipendente (entrata
-- non timbrata entro le 8:00, uscita non timbrata dopo le 17:00): chi,
-- quando, quale timbratura ha creato e con quale orario dichiarato.
create table if not exists public.timbrature_autocorrezioni (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  dipendente_id uuid not null references public.dipendenti(id) on delete cascade,
  timbratura_id uuid not null references public.timbrature(id) on delete cascade,
  tipo text not null check (tipo in ('ENTRATA', 'USCITA')),
  orario_dichiarato timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists timbrature_autocorrezioni_dipendente_id_idx
  on public.timbrature_autocorrezioni (dipendente_id);

alter table public.timbrature_autocorrezioni enable row level security;

create policy timbrature_autocorrezioni_tenant_isolation on public.timbrature_autocorrezioni
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());
