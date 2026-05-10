alter table public.cantieri
  add column if not exists indirizzo text not null default '',
  add column if not exists lavorazioni text not null default '',
  add column if not exists attivo boolean not null default true;
