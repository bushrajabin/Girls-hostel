-- =====================================================================
-- Hostel Management System - Database Schema (Supabase / PostgreSQL)
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =====================================================================

-- ---------- 1. TABLES ------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  room_number  text not null default '',
  phone        text not null default '',
  role         text not null default 'student' check (role in ('student','admin')),
  created_at   timestamptz not null default now()
);

create table if not exists public.complaints (
  id            uuid primary key default gen_random_uuid(),
  ticket_no     bigint generated always as identity,
  student_id    uuid not null references auth.users(id),
  student_name  text not null,
  room_number   text not null,
  contact       text not null,
  category      text not null,
  description   text not null,
  status        text not null default 'Pending'
                check (status in ('Pending','In Progress','Solved')),
  admin_remarks text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table if not exists public.food_feedback (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references auth.users(id),
  student_name  text not null,
  room_number   text not null,
  meal_type     text not null
                check (meal_type in ('Breakfast','Lunch','Snacks','Dinner','Weekly Overall')),
  rating        int  not null check (rating between 1 and 5),
  feedback      text,
  feedback_date date not null default current_date,
  created_at    timestamptz not null default now()
);

create table if not exists public.suggestions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references auth.users(id),
  student_name  text not null,
  room_number   text not null,
  message       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists complaints_created_idx  on public.complaints (created_at desc);
create index if not exists complaints_room_idx     on public.complaints (room_number);
create index if not exists complaints_category_idx on public.complaints (category);
create index if not exists complaints_student_idx  on public.complaints (student_id);
create index if not exists food_created_idx        on public.food_feedback (created_at desc);
create index if not exists sugg_created_idx        on public.suggestions (created_at desc);

-- ---------- 2. HELPER FUNCTIONS & TRIGGERS ---------------------------

-- Admin check (security definer = RLS recursion se bachne ke liye)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Naya user signup hote hi profile bana do.
-- NOTE: role kabhi signup form se nahi aata (security), hamesha 'student' hota hai.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, room_number, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'room_number', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Status change par updated_at / resolved_at automatic set ho
create or replace function public.touch_complaint()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'Solved' and old.status <> 'Solved' then
    new.resolved_at := now();
  elsif new.status <> 'Solved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists complaints_touch on public.complaints;
create trigger complaints_touch
  before update on public.complaints
  for each row execute function public.touch_complaint();

-- ---------- 3. ROW LEVEL SECURITY ------------------------------------
-- Koi DELETE policy nahi hai -> data kabhi delete nahi hoga (permanent history).

alter table public.profiles      enable row level security;
alter table public.complaints    enable row level security;
alter table public.food_feedback enable row level security;
alter table public.suggestions   enable row level security;

-- profiles
drop policy if exists "profile: read own or admin" on public.profiles;
create policy "profile: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- complaints
drop policy if exists "complaints: student insert own" on public.complaints;
create policy "complaints: student insert own" on public.complaints
  for insert with check (student_id = auth.uid());

drop policy if exists "complaints: read own or admin" on public.complaints;
create policy "complaints: read own or admin" on public.complaints
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists "complaints: admin update" on public.complaints;
create policy "complaints: admin update" on public.complaints
  for update using (public.is_admin()) with check (public.is_admin());

-- food feedback
drop policy if exists "food: student insert own" on public.food_feedback;
create policy "food: student insert own" on public.food_feedback
  for insert with check (student_id = auth.uid());

drop policy if exists "food: read own or admin" on public.food_feedback;
create policy "food: read own or admin" on public.food_feedback
  for select using (student_id = auth.uid() or public.is_admin());

-- suggestions
drop policy if exists "sugg: student insert own" on public.suggestions;
create policy "sugg: student insert own" on public.suggestions
  for insert with check (student_id = auth.uid());

drop policy if exists "sugg: read own or admin" on public.suggestions;
create policy "sugg: read own or admin" on public.suggestions
  for select using (student_id = auth.uid() or public.is_admin());

-- ---------- 4. LIVE STATUS (Realtime) --------------------------------
alter publication supabase_realtime add table public.complaints;

-- ---------- 5. ADMIN BANANE KA TARIKA --------------------------------

--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'warden@example.com');


-- for removing every data from the web this query i've to runn

-- truncate table public.complaints, public.food_feedback, public.suggestions restart identity;