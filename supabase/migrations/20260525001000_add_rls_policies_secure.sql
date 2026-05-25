create or replace function public.current_dipendente_ruolo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select d.ruolo
  from public.dipendenti d
  where d.auth_user_id = auth.uid()
    and d.attivo = true
    and d.ruolo in (
      'ADMIN',
      'RESPONSABILE',
      'OPERATORE'
    )
  limit 1
$$;

create or replace function public.current_is_admin_or_responsabile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_dipendente_ruolo() in (
      'ADMIN',
      'RESPONSABILE'
    ),
    false
  )
$$;

create or replace function public.current_is_operatore()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_dipendente_ruolo() = 'OPERATORE',
    false
  )
$$;

create or replace function public.can_view_rapporto_intervento(
  p_rapporto_intervento_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_is_admin_or_responsabile()
    or exists (
      select 1
      from public.rapporti_intervento r
      where r.id = p_rapporto_intervento_id
        and (
          r.created_by = auth.uid()
          or exists (
            select 1
            from public.rapporti_intervento_operatori rio
            join public.dipendenti d
              on d.id = rio.dipendente_id
            where rio.rapporto_intervento_id = r.id
              and d.auth_user_id = auth.uid()
              and d.attivo = true
              and d.ruolo in (
                'ADMIN',
                'RESPONSABILE',
                'OPERATORE'
              )
          )
        )
    ),
    false
  )
$$;

create or replace function public.can_edit_rapporto_intervento(
  p_rapporto_intervento_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_is_admin_or_responsabile()
    or exists (
      select 1
      from public.rapporti_intervento r
      where r.id = p_rapporto_intervento_id
        and r.created_by = auth.uid()
    ),
    false
  )
$$;

create or replace function public.can_edit_timbratura_lavorazione(
  p_timbratura_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_is_admin_or_responsabile()
    or exists (
      select 1
      from public.timbrature t
      where t.id = p_timbratura_id
        and t.user_id = auth.uid()
    ),
    false
  )
$$;

alter table public.cantieri enable row level security;
alter table public.dipendenti enable row level security;
alter table public.lavorazioni_cantiere enable row level security;
alter table public.timbrature_lavorazioni enable row level security;
alter table public.rapporti_intervento enable row level security;
alter table public.rapporti_intervento_foto enable row level security;
alter table public.rapporti_intervento_lavorazioni enable row level security;
alter table public.rapporti_intervento_materiali enable row level security;
alter table public.rapporti_intervento_operatori enable row level security;

drop policy if exists cantieri_select_operativo on public.cantieri;
create policy cantieri_select_operativo
on public.cantieri
for select
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or (
    public.current_is_operatore()
    and attivo = true
  )
);

drop policy if exists cantieri_insert_admin on public.cantieri;
create policy cantieri_insert_admin
on public.cantieri
for insert
to authenticated
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists cantieri_update_admin on public.cantieri;
create policy cantieri_update_admin
on public.cantieri
for update
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
)
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists cantieri_delete_admin on public.cantieri;
create policy cantieri_delete_admin
on public.cantieri
for delete
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists dipendenti_select_operativo on public.dipendenti;
create policy dipendenti_select_operativo
on public.dipendenti
for select
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or (
    public.current_dipendente_ruolo() is not null
    and attivo = true
  )
);

drop policy if exists dipendenti_insert_admin on public.dipendenti;
create policy dipendenti_insert_admin
on public.dipendenti
for insert
to authenticated
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists dipendenti_update_admin on public.dipendenti;
create policy dipendenti_update_admin
on public.dipendenti
for update
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
)
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists dipendenti_delete_admin on public.dipendenti;
create policy dipendenti_delete_admin
on public.dipendenti
for delete
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists lavorazioni_cantiere_select_operativo on public.lavorazioni_cantiere;
create policy lavorazioni_cantiere_select_operativo
on public.lavorazioni_cantiere
for select
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or (
    public.current_is_operatore()
    and attiva = true
  )
);

drop policy if exists lavorazioni_cantiere_insert_admin on public.lavorazioni_cantiere;
create policy lavorazioni_cantiere_insert_admin
on public.lavorazioni_cantiere
for insert
to authenticated
with check (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists lavorazioni_cantiere_update_operativo on public.lavorazioni_cantiere;
create policy lavorazioni_cantiere_update_operativo
on public.lavorazioni_cantiere
for update
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or (
    public.current_is_operatore()
    and attiva = true
  )
)
with check (
  public.current_is_admin_or_responsabile()
  or (
    public.current_is_operatore()
    and attiva = true
  )
);

drop policy if exists lavorazioni_cantiere_delete_admin on public.lavorazioni_cantiere;
create policy lavorazioni_cantiere_delete_admin
on public.lavorazioni_cantiere
for delete
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
);

drop policy if exists timbrature_lavorazioni_select_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_select_operativo
on public.timbrature_lavorazioni
for select
to authenticated
using (
  public.current_dipendente_ruolo() is not null
);

drop policy if exists timbrature_lavorazioni_insert_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_insert_operativo
on public.timbrature_lavorazioni
for insert
to authenticated
with check (
  public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);

drop policy if exists timbrature_lavorazioni_update_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_update_operativo
on public.timbrature_lavorazioni
for update
to authenticated
using (
  public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
)
with check (
  public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);

drop policy if exists timbrature_lavorazioni_delete_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_delete_operativo
on public.timbrature_lavorazioni
for delete
to authenticated
using (
  public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);

drop policy if exists rapporti_intervento_select_operativo on public.rapporti_intervento;
create policy rapporti_intervento_select_operativo
on public.rapporti_intervento
for select
to authenticated
using (
  public.can_view_rapporto_intervento(id)
);

drop policy if exists rapporti_intervento_insert_operativo on public.rapporti_intervento;
create policy rapporti_intervento_insert_operativo
on public.rapporti_intervento
for insert
to authenticated
with check (
  public.current_is_admin_or_responsabile()
  or created_by = auth.uid()
);

drop policy if exists rapporti_intervento_update_operativo on public.rapporti_intervento;
create policy rapporti_intervento_update_operativo
on public.rapporti_intervento
for update
to authenticated
using (
  public.can_edit_rapporto_intervento(id)
)
with check (
  public.can_edit_rapporto_intervento(id)
);

drop policy if exists rapporti_intervento_delete_operativo on public.rapporti_intervento;
create policy rapporti_intervento_delete_operativo
on public.rapporti_intervento
for delete
to authenticated
using (
  public.can_edit_rapporto_intervento(id)
);

drop policy if exists rapporti_intervento_foto_select_operativo on public.rapporti_intervento_foto;
create policy rapporti_intervento_foto_select_operativo
on public.rapporti_intervento_foto
for select
to authenticated
using (
  public.can_view_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_foto_insert_operativo on public.rapporti_intervento_foto;
create policy rapporti_intervento_foto_insert_operativo
on public.rapporti_intervento_foto
for insert
to authenticated
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_foto_update_operativo on public.rapporti_intervento_foto;
create policy rapporti_intervento_foto_update_operativo
on public.rapporti_intervento_foto
for update
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
)
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_foto_delete_operativo on public.rapporti_intervento_foto;
create policy rapporti_intervento_foto_delete_operativo
on public.rapporti_intervento_foto
for delete
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_lavorazioni_select_operativo on public.rapporti_intervento_lavorazioni;
create policy rapporti_intervento_lavorazioni_select_operativo
on public.rapporti_intervento_lavorazioni
for select
to authenticated
using (
  public.can_view_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_lavorazioni_insert_operativo on public.rapporti_intervento_lavorazioni;
create policy rapporti_intervento_lavorazioni_insert_operativo
on public.rapporti_intervento_lavorazioni
for insert
to authenticated
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_lavorazioni_update_operativo on public.rapporti_intervento_lavorazioni;
create policy rapporti_intervento_lavorazioni_update_operativo
on public.rapporti_intervento_lavorazioni
for update
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
)
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_lavorazioni_delete_operativo on public.rapporti_intervento_lavorazioni;
create policy rapporti_intervento_lavorazioni_delete_operativo
on public.rapporti_intervento_lavorazioni
for delete
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_materiali_select_operativo on public.rapporti_intervento_materiali;
create policy rapporti_intervento_materiali_select_operativo
on public.rapporti_intervento_materiali
for select
to authenticated
using (
  public.can_view_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_materiali_insert_operativo on public.rapporti_intervento_materiali;
create policy rapporti_intervento_materiali_insert_operativo
on public.rapporti_intervento_materiali
for insert
to authenticated
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_materiali_update_operativo on public.rapporti_intervento_materiali;
create policy rapporti_intervento_materiali_update_operativo
on public.rapporti_intervento_materiali
for update
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
)
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_materiali_delete_operativo on public.rapporti_intervento_materiali;
create policy rapporti_intervento_materiali_delete_operativo
on public.rapporti_intervento_materiali
for delete
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_operatori_select_operativo on public.rapporti_intervento_operatori;
create policy rapporti_intervento_operatori_select_operativo
on public.rapporti_intervento_operatori
for select
to authenticated
using (
  public.can_view_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_operatori_insert_operativo on public.rapporti_intervento_operatori;
create policy rapporti_intervento_operatori_insert_operativo
on public.rapporti_intervento_operatori
for insert
to authenticated
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_operatori_update_operativo on public.rapporti_intervento_operatori;
create policy rapporti_intervento_operatori_update_operativo
on public.rapporti_intervento_operatori
for update
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
)
with check (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);

drop policy if exists rapporti_intervento_operatori_delete_operativo on public.rapporti_intervento_operatori;
create policy rapporti_intervento_operatori_delete_operativo
on public.rapporti_intervento_operatori
for delete
to authenticated
using (
  public.can_edit_rapporto_intervento(
    rapporto_intervento_id
  )
);
