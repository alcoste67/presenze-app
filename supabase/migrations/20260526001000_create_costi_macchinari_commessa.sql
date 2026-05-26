create table if not exists public.costi_macchinari_commessa (
  id uuid primary key default gen_random_uuid(),
  cantiere_id uuid not null references public.cantieri(id) on delete cascade,
  rapporto_intervento_id uuid null references public.rapporti_intervento(id) on delete set null,
  tipo_macchinario text not null,
  descrizione text not null default '',
  data_utilizzo date not null,
  ore_utilizzo numeric not null,
  tariffa_oraria numeric null,
  costo_totale numeric null,
  note text not null default '',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint costi_macchinari_commessa_tipo_check
    check (
      tipo_macchinario in (
        'SCAVATORE',
        'PLE',
        'AUTOGRU',
        'CAROTAGGIO',
        'ALTRO'
      )
    ),
  constraint costi_macchinari_commessa_ore_check
    check (ore_utilizzo >= 0),
  constraint costi_macchinari_commessa_tariffa_check
    check (
      tariffa_oraria is null
      or tariffa_oraria >= 0
    ),
  constraint costi_macchinari_commessa_costo_check
    check (
      costo_totale is null
      or costo_totale >= 0
    )
);

create index if not exists costi_macchinari_commessa_cantiere_data_idx
  on public.costi_macchinari_commessa (cantiere_id, data_utilizzo);

create index if not exists costi_macchinari_commessa_rapporto_idx
  on public.costi_macchinari_commessa (rapporto_intervento_id);

create index if not exists costi_macchinari_commessa_tipo_idx
  on public.costi_macchinari_commessa (tipo_macchinario);

alter table public.costi_macchinari_commessa enable row level security;

drop policy if exists costi_macchinari_commessa_select_backoffice on public.costi_macchinari_commessa;
create policy costi_macchinari_commessa_select_backoffice
on public.costi_macchinari_commessa
for select
to authenticated
using (
  public.current_is_admin_or_responsabile()
);

drop policy if exists costi_macchinari_commessa_insert_backoffice on public.costi_macchinari_commessa;
create policy costi_macchinari_commessa_insert_backoffice
on public.costi_macchinari_commessa
for insert
to authenticated
with check (
  public.current_is_admin_or_responsabile()
);

drop policy if exists costi_macchinari_commessa_update_backoffice on public.costi_macchinari_commessa;
create policy costi_macchinari_commessa_update_backoffice
on public.costi_macchinari_commessa
for update
to authenticated
using (
  public.current_is_admin_or_responsabile()
)
with check (
  public.current_is_admin_or_responsabile()
);

drop policy if exists costi_macchinari_commessa_delete_backoffice on public.costi_macchinari_commessa;
create policy costi_macchinari_commessa_delete_backoffice
on public.costi_macchinari_commessa
for delete
to authenticated
using (
  public.current_is_admin_or_responsabile()
);
