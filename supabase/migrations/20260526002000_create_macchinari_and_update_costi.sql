create table if not exists public.macchinari (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  descrizione text not null default '',
  costo_orario numeric null,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint macchinari_tipo_check
    check (
      tipo in (
        'SCAVATORE',
        'PLE',
        'AUTOGRU',
        'CAROTAGGIO',
        'ALTRO'
      )
    ),
  constraint macchinari_costo_orario_check
    check (
      costo_orario is null
      or costo_orario >= 0
    )
);

alter table public.macchinari enable row level security;

drop policy if exists macchinari_select_admin on public.macchinari;
create policy macchinari_select_admin
on public.macchinari
for select
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists macchinari_insert_admin on public.macchinari;
create policy macchinari_insert_admin
on public.macchinari
for insert
to authenticated
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists macchinari_update_admin on public.macchinari;
create policy macchinari_update_admin
on public.macchinari
for update
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
)
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists macchinari_delete_admin on public.macchinari;
create policy macchinari_delete_admin
on public.macchinari
for delete
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
);

create or replace view public.macchinari_pubblici as
select
  id,
  nome,
  tipo,
  descrizione,
  attivo
from public.macchinari;

grant select on public.macchinari_pubblici to authenticated;

alter table public.costi_macchinari_commessa
  add column if not exists macchinario_id uuid null
  references public.macchinari(id) on delete set null;

create index if not exists costi_macchinari_commessa_macchinario_idx
  on public.costi_macchinari_commessa (macchinario_id);
