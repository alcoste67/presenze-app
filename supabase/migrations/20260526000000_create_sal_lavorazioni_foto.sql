create table if not exists public.sal_lavorazioni_foto (
  id uuid primary key default gen_random_uuid(),
  cantiere_id uuid not null references public.cantieri(id) on delete cascade,
  lavorazione_id uuid null references public.lavorazioni_cantiere(id) on delete set null,
  timbratura_id uuid null references public.timbrature(id) on delete set null,
  data_riferimento date not null,
  immagine_data_url text not null,
  descrizione text not null default '',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sal_lavorazioni_foto_cantiere_data_idx
  on public.sal_lavorazioni_foto (cantiere_id, data_riferimento);

create index if not exists sal_lavorazioni_foto_lavorazione_idx
  on public.sal_lavorazioni_foto (lavorazione_id);

alter table public.sal_lavorazioni_foto enable row level security;

drop policy if exists sal_lavorazioni_foto_select_operativo on public.sal_lavorazioni_foto;
create policy sal_lavorazioni_foto_select_operativo
on public.sal_lavorazioni_foto
for select
to authenticated
using (
  public.current_dipendente_ruolo() is not null
);

drop policy if exists sal_lavorazioni_foto_insert_operativo on public.sal_lavorazioni_foto;
create policy sal_lavorazioni_foto_insert_operativo
on public.sal_lavorazioni_foto
for insert
to authenticated
with check (
  public.current_is_admin_or_responsabile()
  or (
    public.current_is_operatore()
    and created_by = auth.uid()
  )
);

drop policy if exists sal_lavorazioni_foto_update_operativo on public.sal_lavorazioni_foto;
create policy sal_lavorazioni_foto_update_operativo
on public.sal_lavorazioni_foto
for update
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or created_by = auth.uid()
)
with check (
  public.current_is_admin_or_responsabile()
  or created_by = auth.uid()
);

drop policy if exists sal_lavorazioni_foto_delete_operativo on public.sal_lavorazioni_foto;
create policy sal_lavorazioni_foto_delete_operativo
on public.sal_lavorazioni_foto
for delete
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or created_by = auth.uid()
);
