-- Nous deux : schéma Supabase
create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  display_name text not null default '',
  joined_at timestamptz not null default now()
);
create index if not exists members_couple_idx on public.members(couple_id);

create or replace function public.my_couple() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from public.members where user_id = auth.uid()
$$;

create or replace function public.create_couple(p_name text) returns public.couples
language plpgsql security definer set search_path = public as $$
declare c public.couples;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already in a couple'; end if;
  insert into couples(created_by) values (auth.uid()) returning * into c;
  insert into members(user_id, couple_id, display_name) values (auth.uid(), c.id, left(coalesce(p_name,''), 40));
  return c;
end $$;

create or replace function public.join_couple(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already in a couple'; end if;
  select id into cid from couples where code = upper(trim(p_code));
  if cid is null then raise exception 'code inconnu'; end if;
  if (select count(*) from members where couple_id = cid) >= 2 then raise exception 'couple complet'; end if;
  insert into members(user_id, couple_id, display_name) values (auth.uid(), cid, left(coalesce(p_name,''), 40));
  return cid;
end $$;

revoke all on function public.create_couple(text) from public, anon;
revoke all on function public.join_couple(text, text) from public, anon;
revoke all on function public.my_couple() from public, anon;
grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.my_couple() to authenticated;

-- Contenus
create table if not exists public.settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  path text not null,
  caption text not null default '' check (char_length(caption) <= 200),
  kind text not null default 'photo',
  created_at timestamptz not null default now()
);
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  edited_by uuid default auth.uid(),
  title text not null default '' check (char_length(title) <= 200),
  when_text text not null default '' check (char_length(when_text) <= 80),
  body text not null default '' check (char_length(body) <= 50000),
  photo_path text not null default '',
  position double precision not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.dates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  title text not null check (char_length(title) <= 200),
  when_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  title text not null check (char_length(title) <= 200),
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.quiz (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  question text not null check (char_length(question) <= 300),
  answer text not null check (char_length(answer) <= 200),
  guesses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.strokes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  color text not null default '#000000',
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.game_state (
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  key text not null check (char_length(key) <= 40),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (couple_id, key)
);

-- RLS
alter table public.couples enable row level security;
alter table public.members enable row level security;
drop policy if exists couples_read on public.couples;
create policy couples_read on public.couples for select to authenticated using (id = (select public.my_couple()));
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (couple_id = (select public.my_couple()));
drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple()));

do $$
declare t text;
begin
  foreach t in array array['settings','notes','memories','chapters','dates','films','quiz','strokes','game_state'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (couple_id = (select public.my_couple())) with check (couple_id = (select public.my_couple()))', t||'_all', t);
    execute format('create index if not exists %I on public.%I(couple_id)', t||'_couple_idx', t);
  end loop;
end $$;

-- Temps réel sur les tables
do $$
declare t text;
begin
  foreach t in array array['settings','notes','memories','chapters','dates','films','quiz','strokes','game_state','members'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Canaux temps réel privés (appel vidéo, dessin, réactions)
drop policy if exists couple_channel_read on realtime.messages;
create policy couple_channel_read on realtime.messages for select to authenticated
  using (realtime.topic() = 'couple:' || (select public.my_couple())::text);
drop policy if exists couple_channel_write on realtime.messages;
create policy couple_channel_write on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'couple:' || (select public.my_couple())::text);

-- Stockage des photos (privé, un dossier par couple)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/gif','image/heic'])
on conflict (id) do nothing;
drop policy if exists photos_rw on storage.objects;
create policy photos_rw on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.my_couple())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.my_couple())::text);

-- Chat du mode ciné
create table if not exists public.chat (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  author uuid not null default auth.uid(),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists chat_couple_idx on public.chat(couple_id, created_at desc);
alter table public.chat enable row level security;
drop policy if exists chat_all on public.chat;
create policy chat_all on public.chat for all to authenticated
  using (couple_id = (select public.my_couple()))
  with check (couple_id = (select public.my_couple()) and author = (select auth.uid()));
revoke all on public.chat from anon;
alter publication supabase_realtime add table public.chat;

-- État privé d'un joueur (ex. position de ses bateaux) : lisible par lui seul
create table if not exists public.private_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  couple_id uuid not null default public.my_couple() references public.couples(id) on delete cascade,
  key text not null check (char_length(key) <= 40),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.private_state enable row level security;
drop policy if exists private_state_own on public.private_state;
create policy private_state_own on public.private_state for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple()));
revoke all on public.private_state from anon;
