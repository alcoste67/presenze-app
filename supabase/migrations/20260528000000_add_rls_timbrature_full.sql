-- ==============================================================
-- RLS completa su public.timbrature
--
-- Decisioni di design:
--   SELECT  : owner (user_id = auth.uid()) OPPURE ADMIN/RESPONSABILE (vedono tutto)
--   INSERT  : owner OPPURE ADMIN/RESPONSABILE (possono inserire per qualsiasi user_id)
--   UPDATE  : SOLO ADMIN/RESPONSABILE — gli operai hanno storico append-only
--   DELETE  : bloccato per tutti — lo storico è immutabile
-- ==============================================================

alter table public.timbrature enable row level security;

-- SELECT: owner o admin/responsabile
drop policy if exists timbrature_select on public.timbrature;
drop policy if exists timbrature_select_operativo on public.timbrature;
create policy timbrature_select_operativo
on public.timbrature
for select
to authenticated
using (
  public.current_is_admin_or_responsabile()
  or user_id = auth.uid()
);

-- INSERT: owner o admin/responsabile (ADMIN può specificare qualsiasi user_id)
drop policy if exists timbrature_insert on public.timbrature;
drop policy if exists timbrature_insert_operativo on public.timbrature;
create policy timbrature_insert_operativo
on public.timbrature
for insert
to authenticated
with check (
  public.current_is_admin_or_responsabile()
  or user_id = auth.uid()
);

-- UPDATE: solo admin/responsabile (operai: append-only)
drop policy if exists timbrature_update_operativo on public.timbrature;
create policy timbrature_update_operativo
on public.timbrature
for update
to authenticated
using (
  public.current_is_admin_or_responsabile()
)
with check (
  public.current_is_admin_or_responsabile()
);

-- DELETE: bloccato per tutti — nessuna policy creata
-- Si eliminano eventuali policy DELETE preesistenti per garantire l'immutabilità
drop policy if exists timbrature_delete on public.timbrature;
drop policy if exists timbrature_delete_operativo on public.timbrature;
