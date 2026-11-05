-- =============================================================================
-- 0004 · Core RPCs: registration, pass lookup, check-in, rate limiting, draw
--
-- Public (attendee) RPCs are granted to service_role only. The Next.js server
-- calls them after honeypot, Zod validation and per-IP rate limiting, so a
-- caller holding only the anon key cannot bypass those protections.
-- Staff/admin RPCs are granted to authenticated and check the caller's role.
-- =============================================================================

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'role', '') = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- rate_limit_hit(key, limit, window) -> true if the call is allowed
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.now()) / p_window_seconds) * p_window_seconds
  );
  n integer;
begin
  if p_key is null or pg_catalog.length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit arguments' using errcode = '22023';
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;

  -- Opportunistic cleanup of old windows (about 1 call in 200).
  if pg_catalog.random() < 0.005 then
    delete from public.rate_limits where window_start < pg_catalog.now() - interval '1 day';
  end if;

  return n <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- register_attendee
-- status: created | existing (email matched; pass returned and new dates
--         added) | existing_hidden (mobile taken, email differs; pass hidden)
--         | closed | invalid_dates
-- ---------------------------------------------------------------------------
create or replace function public.register_attendee(
  p_full_name text,
  p_mobile text,
  p_email text,
  p_gender public.gender_t,
  p_age integer,
  p_city text,
  p_area text,
  p_dates date[],
  p_consent boolean,
  p_consent_version text
)
returns table (status text, attendee_id uuid, pass_code text, added_dates integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_mobile text := public.normalise_mobile(p_mobile);
  v_open boolean;
  v_valid_count integer;
  v_id uuid;
  v_code text;
  v_email text;
  v_added integer := 0;
  v_attempt integer := 0;
begin
  select s.registration_open into v_open from public.settings s where s.id = 1;
  if not coalesce(v_open, false) then
    return query select 'closed'::text, null::uuid, null::text, 0;
    return;
  end if;

  if v_mobile is null then
    raise exception 'Invalid mobile number' using errcode = '22023';
  end if;
  if p_consent is distinct from true then
    raise exception 'Consent is required' using errcode = '22023';
  end if;

  select count(distinct d) into v_valid_count
  from pg_catalog.unnest(p_dates) as d
  join public.festival_days fd on fd.festival_date = d and fd.is_active;

  if coalesce(pg_catalog.array_length(p_dates, 1), 0) = 0
     or v_valid_count <> (select count(distinct d) from pg_catalog.unnest(p_dates) as d) then
    return query select 'invalid_dates'::text, null::uuid, null::text, 0;
    return;
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.attendees (
        pass_code, full_name, mobile, email, gender, age, location_city, location_area,
        consent_given, consent_text_version, consent_at
      ) values (
        public.generate_pass_code(), pg_catalog.btrim(p_full_name), v_mobile,
        pg_catalog.lower(pg_catalog.btrim(p_email)), p_gender, p_age,
        pg_catalog.btrim(p_city), nullif(pg_catalog.btrim(coalesce(p_area, '')), ''),
        true, p_consent_version, pg_catalog.now()
      )
      on conflict (mobile) do nothing
      returning id, attendees.pass_code into v_id, v_code;
      exit;
    exception when unique_violation then
      -- pass_code collision (vanishingly rare): retry with a new code.
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  if v_id is not null then
    insert into public.attendee_dates (attendee_id, festival_date)
    select v_id, d from (select distinct pg_catalog.unnest(p_dates) as d) x;
    return query select 'created'::text, v_id, v_code, v_valid_count;
    return;
  end if;

  -- Mobile already registered.
  select a.id, a.pass_code, a.email into v_id, v_code, v_email
  from public.attendees a where a.mobile = v_mobile;

  if v_email = pg_catalog.lower(pg_catalog.btrim(p_email)) then
    insert into public.attendee_dates (attendee_id, festival_date)
    select v_id, d from (select distinct pg_catalog.unnest(p_dates) as d) x
    on conflict do nothing;
    get diagnostics v_added = row_count;
    return query select 'existing'::text, v_id, v_code, v_added;
  else
    -- Do not reveal the pass to someone who only knows the mobile number.
    return query select 'existing_hidden'::text, null::uuid, null::text, 0;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- find_pass: mobile + (pass code or email) -> attendee id
-- ---------------------------------------------------------------------------
create or replace function public.find_pass(p_mobile text, p_pass_code text, p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.attendees a
  where a.mobile = public.normalise_mobile(p_mobile)
    and (
      (p_pass_code is not null and a.pass_code = pg_catalog.upper(pg_catalog.btrim(p_pass_code)))
      or (p_email is not null and a.email = pg_catalog.lower(pg_catalog.btrim(p_email)))
    )
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- get_pass: pass details for a verified token
-- ---------------------------------------------------------------------------
create or replace function public.get_pass(p_attendee_id uuid)
returns table (
  attendee_id uuid, full_name text, pass_code text, dates date[],
  checked_in_today boolean, checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.full_name, a.pass_code,
    coalesce(
      (select pg_catalog.array_agg(ad.festival_date order by ad.festival_date)
         from public.attendee_dates ad where ad.attendee_id = a.id),
      '{}'::date[]
    ),
    c.checkin_at is not null,
    c.checkin_at
  from public.attendees a
  left join public.checkins c
    on c.attendee_id = a.id and c.checkin_date = public.festival_today()
  where a.id = p_attendee_id;
$$;

-- ---------------------------------------------------------------------------
-- checkin(attendee_id, method, staff_id): one row per attendee per IST day.
-- Idempotent: returns status 'checked_in' or 'already'.
--   * method 'staff' -> caller must be active staff/admin and staff_id = caller
--   * method 'self'  -> only the server (service_role) may call it, after it
--                       has verified the venue key and the attendee's details
-- p_scanned_at lets the offline scanner queue keep the real scan time
-- (accepted only within the last 36 hours).
-- ---------------------------------------------------------------------------
create or replace function public.checkin(
  p_attendee_id uuid,
  p_method public.checkin_method,
  p_staff_id uuid default null,
  p_client_ref text default null,
  p_scanned_at timestamptz default null
)
returns table (status text, full_name text, checkin_at timestamptz, checkin_date date, method public.checkin_method)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_at timestamptz := pg_catalog.now();
  v_date date;
  v_name text;
  v_enabled boolean;
  v_row public.checkins%rowtype;
begin
  if p_method = 'staff' then
    if not public.is_staff() or p_staff_id is distinct from (select auth.uid()) then
      raise exception 'Not authorised' using errcode = '42501';
    end if;
  elsif p_method = 'self' then
    if not public.is_service_role() then
      raise exception 'Not authorised' using errcode = '42501';
    end if;
    select s.self_checkin_enabled into v_enabled from public.settings s where s.id = 1;
    if not coalesce(v_enabled, false) then
      return query select 'disabled'::text, null::text, null::timestamptz, null::date, p_method;
      return;
    end if;
  end if;

  if p_scanned_at is not null
     and p_scanned_at between pg_catalog.now() - interval '36 hours' and pg_catalog.now() + interval '5 minutes' then
    v_at := least(p_scanned_at, pg_catalog.now());
  end if;
  v_date := (v_at at time zone 'Asia/Kolkata')::date;

  select a.full_name into v_name from public.attendees a where a.id = p_attendee_id;
  if v_name is null then
    return query select 'not_found'::text, null::text, null::timestamptz, null::date, p_method;
    return;
  end if;

  insert into public.checkins (attendee_id, checkin_date, checkin_at, method, staff_id, client_ref)
  values (
    p_attendee_id, v_date, v_at, p_method,
    case when p_method = 'staff' then p_staff_id else null end,
    p_client_ref
  )
  on conflict do nothing
  returning * into v_row;

  if v_row.id is not null then
    return query select 'checked_in'::text, v_name, v_row.checkin_at, v_row.checkin_date, v_row.method;
    return;
  end if;

  select * into v_row from public.checkins c
  where c.attendee_id = p_attendee_id and c.checkin_date = v_date;

  if v_row.id is null and p_client_ref is not null then
    -- Same idempotency key replayed for a different day: report the original.
    select * into v_row from public.checkins c where c.client_ref = p_client_ref;
  end if;

  return query select 'already'::text, v_name, v_row.checkin_at, v_row.checkin_date, v_row.method;
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_lookup: one attendee by pass code or mobile; minimal fields only.
-- ---------------------------------------------------------------------------
create or replace function public.staff_lookup(p_query text)
returns table (
  attendee_id uuid, full_name text, pass_code text, masked_mobile text,
  dates date[], checked_in_today boolean, checked_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_query, '')));
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if q ~ '^(PBF-?)?[A-HJ-NP-Z2-9]{6}$' then
    -- Accept 'XXXXXX', 'PBFXXXXXX' or 'PBF-XXXXXX'.
    q := 'PBF-' || pg_catalog.right(q, 6);
    select a.id into v_id from public.attendees a where a.pass_code = q;
  else
    select a.id into v_id from public.attendees a where a.mobile = public.normalise_mobile(q);
  end if;

  if v_id is null then
    return;
  end if;

  return query
  select p.attendee_id, p.full_name, p.pass_code,
         public.mask_mobile((select a.mobile from public.attendees a where a.id = v_id)),
         p.dates, p.checked_in_today, p.checked_in_at
  from public.get_pass(v_id) p;
end;
$$;

-- Today's check-ins recorded by the calling staff member.
create or replace function public.staff_today_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.checkins c
  where c.staff_id = (select auth.uid()) and c.checkin_date = public.festival_today();
$$;

-- ---------------------------------------------------------------------------
-- Lucky draw
-- ---------------------------------------------------------------------------
create or replace function public.draw_eligible_count(p_draw_date date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return (
    select count(*)::integer from public.checkins c
    where c.checkin_date = p_draw_date
      and not exists (select 1 from public.draw_winners w where w.attendee_id = c.attendee_id)
  );
end;
$$;

create or replace function public.run_daily_draw(p_draw_date date)
returns table ("position" integer, attendee_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_n integer;
  v_draw_id bigint;
  v_count integer;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  -- Serialise draws so two dates drawn at once cannot pick the same person.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('pbf_run_daily_draw'));

  if exists (select 1 from public.draws d where d.draw_date = p_draw_date) then
    raise exception 'The draw for % has already been run', p_draw_date
      using errcode = 'P0001', hint = 'draw_already_run';
  end if;

  select s.draw_winners_per_day into v_n from public.settings s where s.id = 1;
  v_n := coalesce(v_n, 5);

  if not exists (
    select 1 from public.checkins c
    where c.checkin_date = p_draw_date
      and not exists (select 1 from public.draw_winners w where w.attendee_id = c.attendee_id)
  ) then
    raise exception 'No eligible attendees checked in on %', p_draw_date
      using errcode = 'P0001', hint = 'draw_no_eligible';
  end if;

  insert into public.draws (draw_date, drawn_by, winners_count)
  values (p_draw_date, v_actor, 0)
  returning id into v_draw_id;

  insert into public.draw_winners (draw_id, attendee_id, position)
  select v_draw_id, e.attendee_id, pg_catalog.row_number() over ()
  from (
    select c.attendee_id
    from public.checkins c
    where c.checkin_date = p_draw_date
      and not exists (select 1 from public.draw_winners w where w.attendee_id = c.attendee_id)
    order by pg_catalog.gen_random_uuid()
    limit v_n
  ) e;
  get diagnostics v_count = row_count;

  update public.draws set winners_count = v_count where id = v_draw_id;

  perform public.write_audit(
    v_actor, 'draw.run', 'draws', v_draw_id::text,
    pg_catalog.jsonb_build_object('draw_date', p_draw_date, 'winners', v_count)
  );

  return query
  select w.position, w.attendee_id from public.draw_winners w
  where w.draw_id = v_draw_id order by w.position;
end;
$$;

create or replace function public.admin_publish_draw(p_draw_id bigint, p_publish boolean, p_prize_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select d.draw_date into v_date from public.draws d where d.id = p_draw_id;
  if v_date is null then
    raise exception 'Draw not found' using errcode = 'P0002';
  end if;

  delete from public.public_winner_entries e where e.draw_id = p_draw_id;

  if p_publish then
    insert into public.public_winner_entries (draw_id, attendee_id, draw_date, position, first_name, masked_mobile)
    select w.draw_id, w.attendee_id, v_date, w.position, public.first_name(a.full_name), public.mask_mobile(a.mobile)
    from public.draw_winners w join public.attendees a on a.id = w.attendee_id
    where w.draw_id = p_draw_id;
    update public.draws set published_at = pg_catalog.now(), prize_note = p_prize_note where id = p_draw_id;
  else
    update public.draws set published_at = null where id = p_draw_id;
  end if;

  perform public.write_audit(
    (select auth.uid()), case when p_publish then 'draw.publish' else 'draw.unpublish' end,
    'draws', p_draw_id::text, pg_catalog.jsonb_build_object('draw_date', v_date)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings save: updates the single row and regenerates festival_days.
-- Dates dropped from the range are deleted when unused, or deactivated if
-- attendees already picked them (the admin UI warns first).
-- ---------------------------------------------------------------------------
create or replace function public.admin_dates_with_registrations_outside(p_start date, p_end date)
returns table (festival_date date, registrations integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
  select ad.festival_date, count(*)::integer
  from public.attendee_dates ad
  where ad.festival_date < p_start or ad.festival_date > p_end
  group by ad.festival_date
  order by ad.festival_date;
end;
$$;

create or replace function public.admin_save_settings(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date := (p ->> 'start_date')::date;
  v_end date := (p ->> 'end_date')::date;
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select pg_catalog.to_jsonb(s) into v_before from public.settings s where s.id = 1;

  insert into public.settings as s (
    id, festival_name, festival_year, venue, start_date, end_date, daily_open_time, daily_close_time,
    registration_open, self_checkin_enabled, draw_winners_per_day, staff_limit,
    consent_text_version, privacy_text, contact_email
  ) values (
    1, p ->> 'festival_name', (p ->> 'festival_year')::integer, p ->> 'venue', v_start, v_end,
    (p ->> 'daily_open_time')::time, (p ->> 'daily_close_time')::time,
    (p ->> 'registration_open')::boolean, (p ->> 'self_checkin_enabled')::boolean,
    (p ->> 'draw_winners_per_day')::integer, (p ->> 'staff_limit')::integer,
    p ->> 'consent_text_version', coalesce(p ->> 'privacy_text', ''), nullif(p ->> 'contact_email', '')
  )
  on conflict (id) do update set
    festival_name = excluded.festival_name,
    festival_year = excluded.festival_year,
    venue = excluded.venue,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    daily_open_time = excluded.daily_open_time,
    daily_close_time = excluded.daily_close_time,
    registration_open = excluded.registration_open,
    self_checkin_enabled = excluded.self_checkin_enabled,
    draw_winners_per_day = excluded.draw_winners_per_day,
    staff_limit = excluded.staff_limit,
    consent_text_version = excluded.consent_text_version,
    privacy_text = excluded.privacy_text,
    contact_email = excluded.contact_email;

  insert into public.festival_days (festival_date, is_active)
  select d::date, true from pg_catalog.generate_series(v_start, v_end, interval '1 day') d
  on conflict (festival_date) do update set is_active = true;

  delete from public.festival_days fd
  where (fd.festival_date < v_start or fd.festival_date > v_end)
    and not exists (select 1 from public.attendee_dates ad where ad.festival_date = fd.festival_date);

  update public.festival_days fd set is_active = false
  where (fd.festival_date < v_start or fd.festival_date > v_end) and fd.is_active;

  perform public.write_audit(
    (select auth.uid()), 'settings.update', 'settings', '1',
    pg_catalog.jsonb_build_object('before', v_before, 'after', p)
  );
end;
$$;

-- Admin deletes an attendee on request (DPDP). Cascades to dates, check-ins
-- and wins. Audit keeps the pass code only, never personal details.
create or replace function public.admin_delete_attendee(p_attendee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  delete from public.attendees a where a.id = p_attendee_id returning a.pass_code into v_code;
  if v_code is null then
    raise exception 'Attendee not found' using errcode = 'P0002';
  end if;
  perform public.write_audit(
    (select auth.uid()), 'attendee.delete', 'attendees', p_attendee_id::text,
    pg_catalog.jsonb_build_object('pass_code', v_code)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.is_service_role() from public, anon;
grant execute on function public.is_service_role() to authenticated, service_role;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

revoke all on function public.register_attendee(text, text, text, public.gender_t, integer, text, text, date[], boolean, text) from public, anon, authenticated;
grant execute on function public.register_attendee(text, text, text, public.gender_t, integer, text, text, date[], boolean, text) to service_role;

revoke all on function public.find_pass(text, text, text) from public, anon, authenticated;
grant execute on function public.find_pass(text, text, text) to service_role;

revoke all on function public.get_pass(uuid) from public, anon, authenticated;
grant execute on function public.get_pass(uuid) to service_role;

revoke all on function public.checkin(uuid, public.checkin_method, uuid, text, timestamptz) from public, anon;
grant execute on function public.checkin(uuid, public.checkin_method, uuid, text, timestamptz) to authenticated, service_role;

revoke all on function public.staff_lookup(text) from public, anon;
grant execute on function public.staff_lookup(text) to authenticated;

revoke all on function public.staff_today_count() from public, anon;
grant execute on function public.staff_today_count() to authenticated;

revoke all on function public.draw_eligible_count(date) from public, anon;
grant execute on function public.draw_eligible_count(date) to authenticated;

revoke all on function public.run_daily_draw(date) from public, anon;
grant execute on function public.run_daily_draw(date) to authenticated;

revoke all on function public.admin_publish_draw(bigint, boolean, text) from public, anon;
grant execute on function public.admin_publish_draw(bigint, boolean, text) to authenticated;

revoke all on function public.admin_dates_with_registrations_outside(date, date) from public, anon;
grant execute on function public.admin_dates_with_registrations_outside(date, date) to authenticated;

revoke all on function public.admin_save_settings(jsonb) from public, anon;
grant execute on function public.admin_save_settings(jsonb) to authenticated;

revoke all on function public.admin_delete_attendee(uuid) from public, anon;
grant execute on function public.admin_delete_attendee(uuid) to authenticated;
