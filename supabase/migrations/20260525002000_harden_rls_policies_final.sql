-- Hardening finale delle policy RLS senza cambiare auth o workflow.

drop policy if exists rapporti_intervento_operatori_admin_all on public.rapporti_intervento_operatori;
drop policy if exists timbrature_lavorazioni_insert on public.timbrature_lavorazioni;
drop policy if exists timbrature_lavorazioni_update on public.timbrature_lavorazioni;
drop policy if exists timbrature_lavorazioni_delete on public.timbrature_lavorazioni;

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

drop policy if exists timbrature_lavorazioni_select_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_select_operativo
on public.timbrature_lavorazioni
for select
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);

drop policy if exists timbrature_lavorazioni_insert_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_insert_operativo
on public.timbrature_lavorazioni
for insert
to authenticated
with check (
  public.current_is_admin_or_responsabile()
  or public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);

drop policy if exists timbrature_lavorazioni_update_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_update_operativo
on public.timbrature_lavorazioni
for update
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
)
with check (
  public.current_is_admin_or_responsabile()
  or public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);

drop policy if exists timbrature_lavorazioni_delete_operativo on public.timbrature_lavorazioni;
create policy timbrature_lavorazioni_delete_operativo
on public.timbrature_lavorazioni
for delete
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or public.can_edit_timbratura_lavorazione(
    timbratura_id
  )
);
