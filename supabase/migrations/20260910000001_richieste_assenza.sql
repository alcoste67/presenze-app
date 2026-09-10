-- Richieste ferie/permesso: il dipendente chiede un periodo (giorno/i,
-- intero o parziale con ore), l'admin approva o rifiuta. Una volta
-- approvata compare nel calendario condiviso. La logica di quante ore
-- valga una giornata intera ai fini del libro paghe NON è ancora
-- implementata qui: va decisa a parte prima di toccare quel calcolo.

create table if not exists public.richieste_assenza (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  dipendente_id uuid not null references public.dipendenti(id) on delete cascade,
  tipo text not null check (tipo in ('FERIE', 'PERMESSO')),
  data_inizio date not null,
  data_fine date not null,
  giornata_intera boolean not null default true,
  ore numeric null,
  stato text not null default 'IN_ATTESA' check (stato in ('IN_ATTESA', 'APPROVATA', 'RIFIUTATA')),
  nota text not null default '',
  approvata_da uuid references public.dipendenti(id),
  approvata_il timestamptz,
  created_at timestamptz not null default now(),
  constraint richieste_assenza_date_check check (data_fine >= data_inizio),
  constraint richieste_assenza_parziale_check check (
    (giornata_intera = true and ore is null)
    or (
      giornata_intera = false
      and ore is not null
      and ore > 0
      and data_inizio = data_fine
    )
  )
);

create index if not exists richieste_assenza_dipendente_periodo_idx
  on public.richieste_assenza (dipendente_id, data_inizio, data_fine);

create index if not exists richieste_assenza_azienda_stato_idx
  on public.richieste_assenza (azienda_id, stato);

alter table public.richieste_assenza enable row level security;

create policy richieste_assenza_tenant_isolation on public.richieste_assenza
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());
