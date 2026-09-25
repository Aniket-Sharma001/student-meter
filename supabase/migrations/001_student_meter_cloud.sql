-- Student Meter cloud schema. Browser clients must use the public anon key only.
-- Never expose a Supabase service-role key in frontend code.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  course text not null default '',
  college text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_meter_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  app_data jsonb not null default '{}'::jsonb check (jsonb_typeof(app_data) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  name text not null,
  short_name text not null default '',
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index if not exists branches_owner_name_unique
  on public.branches (user_id, lower(name));

create table if not exists public.semesters (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  branch_id uuid not null,
  name text not null,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, branch_id) references public.branches (user_id, id) on delete cascade
);
create index if not exists semesters_owner_branch_idx on public.semesters (user_id, branch_id);
create unique index if not exists semesters_owner_branch_name_unique
  on public.semesters (user_id, branch_id, lower(name));

create table if not exists public.subjects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  semester_id uuid not null,
  name text not null,
  code text not null default '',
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, semester_id) references public.semesters (user_id, id) on delete cascade
);
create index if not exists subjects_owner_semester_idx on public.subjects (user_id, semester_id);
create unique index if not exists subjects_owner_semester_name_unique
  on public.subjects (user_id, semester_id, lower(name));

create table if not exists public.vault_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  subject_id uuid not null,
  item_type text not null check (item_type in ('note', 'personal', 'question', 'material', 'result', 'link')),
  title text not null,
  favorite boolean not null default false,
  tags text[] not null default '{}',
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, subject_id) references public.subjects (user_id, id) on delete cascade
);
create index if not exists vault_items_owner_subject_idx on public.vault_items (user_id, subject_id);
create index if not exists vault_items_owner_type_idx on public.vault_items (user_id, item_type);
create index if not exists vault_items_owner_favorite_idx on public.vault_items (user_id) where favorite;
create index if not exists vault_items_tags_idx on public.vault_items using gin (tags);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'student_meter_data', 'branches', 'semesters', 'subjects', 'vault_items']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end
$$;

create or replace function public.get_student_meter_data()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case when exists (
    select 1 from public.student_meter_data where user_id = auth.uid()
  ) then jsonb_build_object(
    'revision', (select revision from public.student_meter_data where user_id = auth.uid()),
    'updatedAt', (select updated_at from public.student_meter_data where user_id = auth.uid()),
    'snapshot', jsonb_build_object(
      'version', 1,
      'appData', case
        when coalesce((select app_data from public.student_meter_data where user_id = auth.uid()), '{}'::jsonb) ? 'profile'
          then coalesce((select app_data from public.student_meter_data where user_id = auth.uid()), '{}'::jsonb)
        else coalesce((select app_data from public.student_meter_data where user_id = auth.uid()), '{}'::jsonb)
          || jsonb_build_object('profile', jsonb_build_object(
            'name', coalesce((select name from public.profiles where user_id = auth.uid()), ''),
            'branch', coalesce((select course from public.profiles where user_id = auth.uid()), ''),
            'college', coalesce((select college from public.profiles where user_id = auth.uid()), ''),
            'semester', '', 'studyGoal', 120
          ))
      end,
      'vault', jsonb_build_object(
        'branches', coalesce((select jsonb_agg(record order by created_at) from public.branches where user_id = auth.uid()), '[]'::jsonb),
        'semesters', coalesce((select jsonb_agg(record order by created_at) from public.semesters where user_id = auth.uid()), '[]'::jsonb),
        'subjects', coalesce((select jsonb_agg(record order by created_at) from public.subjects where user_id = auth.uid()), '[]'::jsonb),
        'items', coalesce((select jsonb_agg(record order by created_at) from public.vault_items where user_id = auth.uid()), '[]'::jsonb)
      )
    )
  ) else null end;
$$;

create or replace function public.sync_student_meter_data(p_snapshot jsonb, p_expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  current_revision bigint;
  next_revision bigint;
  row_data jsonb;
begin
  if owner_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  if jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_snapshot->>'version' is distinct from '1'
    or jsonb_typeof(p_snapshot->'appData') is distinct from 'object'
    or jsonb_typeof(p_snapshot->'vault') is distinct from 'object'
    or jsonb_typeof(p_snapshot->'vault'->'branches') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'vault'->'semesters') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'vault'->'subjects') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'vault'->'items') is distinct from 'array'
    or jsonb_typeof(p_snapshot->'profile') is distinct from 'object' then
    raise exception 'INVALID_STUDENT_METER_SNAPSHOT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_snapshot->'appData') as settings(key)
    where key not in (
      'profile', 'study', 'xp', 'studyDays', 'goals', 'challenges', 'challengeHistory',
      'challengeDays', 'mood', 'money', 'timer', 'routine', 'reminderSettings',
      'reminderState', 'theme'
    )
  ) then
    raise exception 'INVALID_STUDENT_METER_SETTING';
  end if;
  if p_snapshot->'appData' ? 'profile' and (
    jsonb_typeof(p_snapshot->'appData'->'profile') is distinct from 'object'
    or exists (
      select 1 from jsonb_object_keys(p_snapshot->'appData'->'profile') as fields(key)
      where key not in ('name', 'college', 'branch', 'semester', 'studyGoal')
    )
  ) then
    raise exception 'INVALID_STUDENT_METER_PROFILE';
  end if;

  select revision into current_revision
  from public.student_meter_data
  where user_id = owner_id
  for update;

  if not found then
    if p_expected_revision is not null then
      raise exception 'SYNC_CONFLICT';
    end if;
    next_revision := 1;
    insert into public.student_meter_data (user_id, app_data, revision, updated_at)
      values (owner_id, p_snapshot->'appData', next_revision, now());
  else
    if p_expected_revision is null or p_expected_revision <> current_revision then
      raise exception 'SYNC_CONFLICT';
    end if;
    next_revision := current_revision + 1;
    update public.student_meter_data
      set app_data = p_snapshot->'appData', revision = next_revision, updated_at = now()
      where user_id = owner_id;
  end if;

  insert into public.profiles (user_id, name, course, college, updated_at)
  values (
    owner_id,
    left(coalesce(p_snapshot->'profile'->>'name', ''), 80),
    left(coalesce(p_snapshot->'profile'->>'course', ''), 100),
    left(coalesce(p_snapshot->'profile'->>'college', ''), 120),
    now()
  )
  on conflict (user_id) do update
    set name = excluded.name, course = excluded.course, college = excluded.college, updated_at = excluded.updated_at;

  delete from public.branches where user_id = owner_id;

  for row_data in select value from jsonb_array_elements(p_snapshot->'vault'->'branches')
  loop
    insert into public.branches (user_id, id, name, short_name, record, created_at, updated_at)
    values (
      owner_id, (row_data->>'id')::uuid, row_data->>'name', coalesce(row_data->>'shortName', ''),
      row_data, coalesce((row_data->>'createdAt')::timestamptz, now()),
      coalesce((row_data->>'updatedAt')::timestamptz, now())
    );
  end loop;

  for row_data in select value from jsonb_array_elements(p_snapshot->'vault'->'semesters')
  loop
    insert into public.semesters (user_id, id, branch_id, name, record, created_at, updated_at)
    values (
      owner_id, (row_data->>'id')::uuid, (row_data->>'branchId')::uuid, row_data->>'name',
      row_data, coalesce((row_data->>'createdAt')::timestamptz, now()),
      coalesce((row_data->>'updatedAt')::timestamptz, now())
    );
  end loop;

  for row_data in select value from jsonb_array_elements(p_snapshot->'vault'->'subjects')
  loop
    insert into public.subjects (user_id, id, semester_id, name, code, record, created_at, updated_at)
    values (
      owner_id, (row_data->>'id')::uuid, (row_data->>'semesterId')::uuid, row_data->>'name',
      coalesce(row_data->>'code', ''), row_data, coalesce((row_data->>'createdAt')::timestamptz, now()),
      coalesce((row_data->>'updatedAt')::timestamptz, now())
    );
  end loop;

  for row_data in select value from jsonb_array_elements(p_snapshot->'vault'->'items')
  loop
    insert into public.vault_items (user_id, id, subject_id, item_type, title, favorite, tags, record, created_at, updated_at)
    values (
      owner_id, (row_data->>'id')::uuid, (row_data->>'subjectId')::uuid, row_data->>'type',
      row_data->>'title', coalesce((row_data->>'favorite')::boolean, false),
      array(select jsonb_array_elements_text(coalesce(row_data->'tags', '[]'::jsonb))),
      row_data, coalesce((row_data->>'createdAt')::timestamptz, now()),
      coalesce((row_data->>'updatedAt')::timestamptz, now())
    );
  end loop;

  return next_revision;
end;
$$;

revoke all on function public.get_student_meter_data() from public, anon;
revoke all on function public.sync_student_meter_data(jsonb, bigint) from public, anon;
grant execute on function public.get_student_meter_data() to authenticated;
grant execute on function public.sync_student_meter_data(jsonb, bigint) to authenticated;
