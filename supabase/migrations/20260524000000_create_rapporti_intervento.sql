create table if not exists public.rapporti_intervento (
  id uuid primary key default gen_random_uuid(),
  cantiere_id uuid not null references public.cantieri(id),
  cantiere_nome_snapshot text not null,
  cantiere_indirizzo_snapshot text not null default '',
  data_intervento date not null,
  cliente_committente text not null,
  responsabile_nome text not null,
  ore_uomo_reali_minuti integer not null default 0,
  viaggio_minuti integer not null default 0,
  diritto_uscita boolean not null default false,
  regola_fatturazione text not null,
  ore_fatturabili_minuti integer not null default 0,
  note text not null default '',
  firma_responsabile_data_url text null,
  firma_responsabile_nome text null,
  firma_responsabile_at timestamptz null,
  firma_cliente_data_url text null,
  firma_cliente_nome text null,
  firma_cliente_at timestamptz null,
  stato text not null default 'BOZZA',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rapporti_intervento_ore_uomo_reali_check
    check (ore_uomo_reali_minuti >= 0),
  constraint rapporti_intervento_viaggio_check
    check (viaggio_minuti >= 0),
  constraint rapporti_intervento_ore_fatturabili_check
    check (ore_fatturabili_minuti >= 0),
  constraint rapporti_intervento_regola_fatturazione_check
    check (
      regola_fatturazione in (
        'MEZZA_GIORNATA',
        'GIORNATA',
        'ORE_REALI'
      )
    ),
  constraint rapporti_intervento_stato_check
    check (
      stato in (
        'BOZZA',
        'FIRMATO',
        'ANNULLATO'
      )
    )
);

create table if not exists public.rapporti_intervento_lavorazioni (
  id uuid primary key default gen_random_uuid(),
  rapporto_intervento_id uuid not null references public.rapporti_intervento(id) on delete cascade,
  lavorazione_id uuid null references public.lavorazioni_cantiere(id) on delete set null,
  descrizione_snapshot text not null,
  ore_uomo_minuti integer not null default 0,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  constraint rapporti_intervento_lavorazioni_ore_uomo_check
    check (ore_uomo_minuti >= 0)
);

create index if not exists rapporti_intervento_cantiere_data_idx
  on public.rapporti_intervento (cantiere_id, data_intervento);

create index if not exists rapporti_intervento_stato_idx
  on public.rapporti_intervento (stato);

create index if not exists rapporti_intervento_lavorazioni_rapporto_idx
  on public.rapporti_intervento_lavorazioni (rapporto_intervento_id);

create index if not exists rapporti_intervento_lavorazioni_lavorazione_idx
  on public.rapporti_intervento_lavorazioni (lavorazione_id);
