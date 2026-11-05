-- Bitácora schema. Paste it in the Supabase SQL editor or apply it with `supabase db push`.
--
-- Access needs both conditions: owning the row and appearing in `allowed_users`. That table has
-- no write policies, so it is only editable from the dashboard: anyone can sign in, but only
-- allowed accounts reach any data.

create table public.allowed_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- A day is the unit that gets edited and exported, so its entries live with it as JSONB: saving
-- a day is one atomic upsert, which keeps offline sync simple.
create table public.day_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  day_type text not null default 'full' check (day_type in ('full', 'half', 'off')),
  include_daily boolean not null default true,
  start_minutes integer check (start_minutes between 0 and 1439),
  entries jsonb not null default '[]'::jsonb check (
    case when jsonb_typeof(entries) = 'array' then jsonb_array_length(entries) <= 40 else false end
  ),
  exported_at timestamptz,
  exported_fingerprint text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.pending_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  date date not null,
  created_at timestamptz not null default now()
);

create index pending_items_user_id_idx on public.pending_items (user_id);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger day_logs_touch_updated_at
  before update on public.day_logs
  for each row execute function public.touch_updated_at();

create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

revoke all on function public.touch_updated_at() from public, anon, authenticated;

revoke all on public.allowed_users, public.day_logs, public.pending_items, public.user_settings
  from public, anon, authenticated;

grant select on public.allowed_users to authenticated;
grant select, insert, update, delete on public.day_logs, public.pending_items, public.user_settings
  to authenticated;

alter table public.allowed_users enable row level security;
alter table public.day_logs enable row level security;
alter table public.pending_items enable row level security;
alter table public.user_settings enable row level security;

create policy "users can check their own access"
  on public.allowed_users for select to authenticated
  using (user_id = (select auth.uid()));

create policy "allowed users manage their own days"
  on public.day_logs for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy "allowed users manage their own pending items"
  on public.pending_items for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy "allowed users manage their own settings"
  on public.user_settings for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );
