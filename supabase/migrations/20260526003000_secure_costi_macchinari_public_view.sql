drop policy if exists costi_macchinari_commessa_select_backoffice on public.costi_macchinari_commessa;
create policy costi_macchinari_commessa_select_backoffice
on public.costi_macchinari_commessa
for select
to authenticated
using (
  public.current_dipendente_ruolo() = 'ADMIN'
);

create or replace view public.costi_macchinari_pubblici as
select
  id,
  cantiere_id,
  rapporto_intervento_id,
  macchinario_id,
  tipo_macchinario,
  descrizione,
  data_utilizzo,
  ore_utilizzo,
  note,
  created_by,
  created_at,
  updated_at
from public.costi_macchinari_commessa;

grant select on public.costi_macchinari_pubblici to authenticated;
