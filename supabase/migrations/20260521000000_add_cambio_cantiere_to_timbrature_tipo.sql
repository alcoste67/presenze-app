do $$
declare
  tipo_attnum smallint;
  tipo_constraint record;
  tipo_type_oid oid;
begin
  select a.attnum, a.atttypid
  into tipo_attnum, tipo_type_oid
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'timbrature'
    and a.attname = 'tipo'
    and not a.attisdropped;

  if tipo_attnum is null or tipo_type_oid is null then
    raise exception 'Colonna public.timbrature.tipo non trovata';
  end if;

  if exists (
    select 1
    from pg_type
    where oid = tipo_type_oid
      and typtype = 'e'
  ) then
    execute format(
      'alter type %s add value if not exists %L',
      tipo_type_oid::regtype,
      'CAMBIO_CANTIERE'
    );
  end if;

  for tipo_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.timbrature'::regclass
      and contype = 'c'
      and conkey @> array[tipo_attnum]::smallint[]
  loop
    execute format(
      'alter table public.timbrature drop constraint %I',
      tipo_constraint.conname
    );
  end loop;
end $$;

alter table public.timbrature
  add constraint timbrature_tipo_check
  check (
    tipo in (
      'ENTRATA',
      'PAUSA',
      'RIENTRO',
      'USCITA',
      'CAMBIO_CANTIERE'
    )
  );
