create table if not exists public.dipendenti (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  email text not null unique,
  ruolo text not null,
  attivo boolean not null default true,
  auth_user_id uuid null unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dipendenti_ruolo_check check (
    ruolo in (
      'OPERAIO',
      'RESPONSABILE',
      'UFFICIO',
      'ADMIN'
    )
  )
);
