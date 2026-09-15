-- Rilevamento turno aperto da troppe ore (dipendente ancora DENTRO/IN_PAUSA
-- da più di 10 ore nette) e flusso di correzione con doppia conferma:
-- l'admin propone un orario di uscita, il dipendente deve confermarlo prima
-- che la timbratura venga effettivamente creata.

-- Traccia le anomalie rilevate dal cron (una riga per turno aperto, non una
-- per ogni tick): evita di notificare admin/superadmin ripetutamente per lo
-- stesso turno. `timbratura_apertura_id` è la timbratura (ENTRATA/RIENTRO/
-- CAMBIO_CANTIERE) che ha aperto il turno ancora senza uscita.
create table if not exists public.timbrature_avvisi_anomalia (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  dipendente_id uuid not null references public.dipendenti(id) on delete cascade,
  timbratura_apertura_id uuid not null references public.timbrature(id) on delete cascade,
  ore_nette_al_momento numeric not null,
  creato_il timestamptz not null default now(),
  risolto_il timestamptz,
  constraint timbrature_avvisi_anomalia_apertura_key unique (timbratura_apertura_id)
);

create index if not exists timbrature_avvisi_anomalia_dipendente_id_idx
  on public.timbrature_avvisi_anomalia (dipendente_id);

alter table public.timbrature_avvisi_anomalia enable row level security;

create policy timbrature_avvisi_anomalia_tenant_isolation on public.timbrature_avvisi_anomalia
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());

-- Proposta di correzione fatta da un ADMIN/SUPERADMIN per il turno aperto di
-- un altro dipendente: resta IN_ATTESA finché il dipendente stesso non la
-- conferma (a quel punto viene creata la timbratura USCITA vera, vedi
-- `timbratura_id`) o la rifiuta con una nota (nessuna timbratura creata).
create table if not exists public.timbrature_proposte_correzione (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id),
  dipendente_id uuid not null references public.dipendenti(id) on delete cascade,
  proposto_da uuid not null references public.dipendenti(id),
  avviso_anomalia_id uuid references public.timbrature_avvisi_anomalia(id) on delete set null,
  orario_proposto timestamptz not null,
  stato text not null default 'IN_ATTESA' check (stato in ('IN_ATTESA', 'CONFERMATA', 'RIFIUTATA')),
  nota_rifiuto text,
  timbratura_id uuid references public.timbrature(id) on delete set null,
  creato_il timestamptz not null default now(),
  risposto_il timestamptz
);

create index if not exists timbrature_proposte_correzione_dipendente_id_idx
  on public.timbrature_proposte_correzione (dipendente_id);

-- Evita due proposte in attesa in parallelo per lo stesso turno aperto
-- (l'admin che riapre la pagina di correzione due volte, doppio click, ecc.)
create unique index if not exists timbrature_proposte_correzione_avviso_in_attesa_key
  on public.timbrature_proposte_correzione (avviso_anomalia_id)
  where stato = 'IN_ATTESA';

alter table public.timbrature_proposte_correzione enable row level security;

create policy timbrature_proposte_correzione_tenant_isolation on public.timbrature_proposte_correzione
  as restrictive for all to authenticated
  using (azienda_id = public.current_azienda_id())
  with check (azienda_id = public.current_azienda_id());
