-- =============================================================================
-- 0002 · Helper functions and triggers
-- All security-definer functions pin search_path = '' and use qualified names.
-- =============================================================================

-- Festival "today" is always computed in the database, in Asia/Kolkata.
create or replace function public.festival_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.now() at time zone 'Asia/Kolkata')::date;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'admin'
  );
$$;

-- Staff or admin (admins can also use the gate scanner).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

-- '+919812345621' -> '98XXXXXX21'
create or replace function public.mask_mobile(p_mobile text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_mobile is null then null
    else pg_catalog.left(pg_catalog.right(p_mobile, 10), 2) || 'XXXXXX' || pg_catalog.right(p_mobile, 2)
  end;
$$;

create or replace function public.first_name(p_full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.split_part(pg_catalog.btrim(p_full_name), ' ', 1);
$$;

-- Age bands used by the dashboard and reports.
create or replace function public.age_band(p_age integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_age <= 12 then '12 and under'
    when p_age <= 17 then '13–17'
    when p_age <= 24 then '18–24'
    when p_age <= 34 then '25–34'
    when p_age <= 44 then '35–44'
    when p_age <= 59 then '45–59'
    else '60 and over'
  end;
$$;

-- Normalise any 10-digit Indian mobile input to E.164 (+91XXXXXXXXXX). Null if invalid.
create or replace function public.normalise_mobile(p_input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := pg_catalog.regexp_replace(coalesce(p_input, ''), '[^0-9]', '', 'g');
begin
  if pg_catalog.length(d) = 12 and pg_catalog.left(d, 2) = '91' then
    d := pg_catalog.right(d, 10);
  elsif pg_catalog.length(d) = 11 and pg_catalog.left(d, 1) = '0' then
    d := pg_catalog.right(d, 10);
  end if;
  if d ~ '^[6-9][0-9]{9}$' then
    return '+91' || d;
  end if;
  return null;
end;
$$;

-- Short human-readable code, e.g. PBF-7K3Q9X. Uses gen_random_uuid() bytes,
-- which come from a cryptographically strong source. 32-symbol alphabet with
-- no 0/O/1/I to avoid confusion when read aloud.
create or replace function public.generate_pass_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
  code text := 'PBF-';
  i int;
begin
  for i in 0..5 loop
    code := code || pg_catalog.substr(alphabet, (pg_catalog.get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists attendees_touch on public.attendees;
create trigger attendees_touch before update on public.attendees
  for each row execute function public.touch_updated_at();
drop trigger if exists partners_touch on public.partners;
create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();
drop trigger if exists key_people_touch on public.key_people;
create trigger key_people_touch before update on public.key_people
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- Enforce the configurable staff account limit (active staff only; admins excluded).
create or replace function public.enforce_staff_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim int;
  active_count int;
begin
  if new.role = 'staff' and new.is_active then
    select s.staff_limit into lim from public.settings s where s.id = 1;
    select count(*) into active_count
      from public.profiles p
      where p.role = 'staff' and p.is_active and p.id <> new.id;
    if active_count >= coalesce(lim, 10) then
      raise exception 'Staff limit of % active accounts reached', coalesce(lim, 10)
        using errcode = 'P0001', hint = 'staff_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_staff_limit on public.profiles;
create trigger profiles_staff_limit before insert or update of role, is_active on public.profiles
  for each row execute function public.enforce_staff_limit();

-- Internal audit writer (not granted to clients).
create or replace function public.write_audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Admin-callable audit entry (staff changes, exports, partner edits...).
create or replace function public.log_audit(
  p_action text, p_entity text, p_entity_id text default null, p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  perform public.write_audit((select auth.uid()), p_action, p_entity, p_entity_id, p_details);
end;
$$;
