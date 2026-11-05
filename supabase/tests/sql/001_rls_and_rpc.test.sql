-- =============================================================================
-- Database tests: RLS, grants and business RPCs.
-- Runs inside one transaction and rolls back. Any failed assertion raises.
--   Local Supabase:   pnpm test:db          (uses SUPABASE_DB_URL or the CLI default)
--   Plain Postgres:   pnpm test:db:harness  (scripts/test-db-local.sh)
-- =============================================================================
\set ON_ERROR_STOP 1
begin;
create schema tests;

create or replace function tests.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
  raise notice 'ok - %', msg;
end $$;

-- Expect a statement to fail with insufficient_privilege.
create or replace function tests.expect_denied(stmt text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'ASSERTION FAILED (no error): %', msg;
exception
  when insufficient_privilege then raise notice 'ok - %', msg;
end $$;

-- Expect a statement to raise any error whose message contains a fragment.
create or replace function tests.expect_error(stmt text, fragment text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'ASSERTION FAILED (no error): %', msg;
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    if position(fragment in sqlerrm) = 0 then
      raise exception 'ASSERTION FAILED: % (got: %)', msg, sqlerrm;
    end if;
    raise notice 'ok - %', msg;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
grant usage on schema tests to anon, authenticated, service_role;

-- Fixed festival window around "today" so check-ins and draws line up.
update public.settings set start_date = public.festival_today() - 2, end_date = public.festival_today() + 2,
  draw_winners_per_day = 5, registration_open = true, self_checkin_enabled = true, staff_limit = 3
where id = 1;
delete from public.festival_days fd
  where not exists (select 1 from public.attendee_dates ad where ad.festival_date = fd.festival_date);
insert into public.festival_days (festival_date)
select d::date from generate_series(public.festival_today() - 2, public.festival_today() + 2, interval '1 day') d
on conflict (festival_date) do update set is_active = true;

-- Users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'staff2@test.local');
insert into public.profiles (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin@test.local', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'Staff One', 'staff1@test.local', 'staff'),
  ('00000000-0000-0000-0000-0000000000b2', 'Staff Two', 'staff2@test.local', 'staff');

-- =============================================================================
-- 1. Registration through service_role
-- =============================================================================
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to anon, authenticated, service_role;

do $$
declare r record; i int;
begin
  select * into r from public.register_attendee('Asha Kulkarni', '98123 45621', 'Asha@Example.com', 'female', 29,
    'Pune', 'Kothrud', array[public.festival_today(), public.festival_today() + 1], true, 'v1');
  perform tests.assert(r.status = 'created', 'register creates attendee');
  perform tests.assert(r.pass_code ~ '^PBF-[A-HJ-NP-Z2-9]{6}$', 'pass code format');
  perform tests.assert(r.added_dates = 2, 'two dates stored');
  insert into t_ids values ('asha', r.attendee_id);

  select * into r from public.register_attendee('Asha K', '+91 9812345621', 'asha@example.com', 'female', 29,
    'Pune', null, array[public.festival_today() + 1, public.festival_today() + 2], true, 'v1');
  perform tests.assert(r.status = 'existing', 'duplicate mobile + same email returns existing pass');
  perform tests.assert(r.attendee_id = (select id from t_ids where k = 'asha'), 'existing pass id matches');
  perform tests.assert(r.added_dates = 1, 'only the new date is added');
  perform tests.assert((select count(*) from public.attendees where mobile = '+919812345621') = 1, 'no duplicate row');

  select * into r from public.register_attendee('Someone Else', '9812345621', 'other@example.com', 'male', 40,
    'Mumbai', null, array[public.festival_today()], true, 'v1');
  perform tests.assert(r.status = 'existing_hidden' and r.attendee_id is null,
    'duplicate mobile with different email does not reveal pass');

  select * into r from public.register_attendee('Bad Date', '9000000001', 'b@example.com', 'male', 40,
    'Pune', null, array[public.festival_today() + 30], true, 'v1');
  perform tests.assert(r.status = 'invalid_dates', 'dates outside festival are rejected');

  select * into r from public.register_attendee('No Dates', '9000000002', 'b@example.com', 'male', 40,
    'Pune', null, array[]::date[], true, 'v1');
  perform tests.assert(r.status = 'invalid_dates', 'at least one date is required');

  perform tests.assert(
    (select consent_given and consent_text_version = 'v1' and consent_at is not null
       from public.attendees where id = (select id from t_ids where k = 'asha')),
    'consent stored with version and timestamp');

  -- Eight more attendees for check-in and draw tests.
  for i in 1..8 loop
    select * into r from public.register_attendee('Reader ' || i, '97000000' || lpad(i::text, 2, '0'),
      'reader' || i || '@example.com', 'other', 20 + i, 'Pune', null, array[public.festival_today()], true, 'v1');
    insert into t_ids values ('r' || i, r.attendee_id);
  end loop;
end $$;

select tests.expect_error(
  $q$select public.register_attendee('No Consent', '9000000003', 'c@example.com', 'male', 40, 'Pune', null,
     array[public.festival_today()], false, 'v1')$q$,
  'Consent is required', 'consent checkbox is mandatory');

select tests.expect_error(
  $q$select public.register_attendee('Bad Mobile', '12345', 'c@example.com', 'male', 40, 'Pune', null,
     array[public.festival_today()], true, 'v1')$q$,
  'Invalid mobile', 'invalid mobile is rejected');

select tests.expect_error(
  $q$select public.register_attendee('Old', '9000000004', 'c@example.com', 'male', 130, 'Pune', null,
     array[public.festival_today()], true, 'v1')$q$,
  'attendees_age_check', 'age must be 1-120');

do $$ begin
  perform tests.assert(
    public.find_pass('9812345621', (select pass_code from public.attendees where mobile = '+919812345621'), null)
      = (select id from t_ids where k = 'asha'), 'find_pass by mobile + pass code');
  perform tests.assert(public.find_pass('9812345621', null, 'ASHA@example.com') is not null, 'find_pass by mobile + email');
  perform tests.assert(public.find_pass('9812345621', 'PBF-AAAAAA', null) is null, 'find_pass rejects wrong code');
  perform tests.assert(public.find_pass('9812345621', null, null) is null, 'find_pass needs a second factor');
end $$;

-- Rate limiter
do $$ begin
  perform tests.assert(public.rate_limit_hit('test:1.2.3.4', 2, 60), 'rate limit hit 1 allowed');
  perform tests.assert(public.rate_limit_hit('test:1.2.3.4', 2, 60), 'rate limit hit 2 allowed');
  perform tests.assert(not public.rate_limit_hit('test:1.2.3.4', 2, 60), 'rate limit hit 3 blocked');
end $$;

-- Self check-in (service_role, method self)
do $$
declare r record;
begin
  select * into r from public.checkin((select id from t_ids where k = 'asha'), 'self');
  perform tests.assert(r.status = 'checked_in' and r.method = 'self', 'self check-in recorded with method self');
  perform tests.assert(r.checkin_date = public.festival_today(), 'check-in date is today in Asia/Kolkata');
  select * into r from public.checkin((select id from t_ids where k = 'asha'), 'self');
  perform tests.assert(r.status = 'already', 'second self check-in is idempotent');
end $$;
reset role;

-- =============================================================================
-- 2. Anonymous users cannot read personal data
-- =============================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select tests.expect_denied('select * from public.attendees', 'anon cannot select attendees');
select tests.expect_denied('select * from public.attendee_dates', 'anon cannot select attendee_dates');
select tests.expect_denied('select * from public.checkins', 'anon cannot select checkins');
select tests.expect_denied('select * from public.audit_log', 'anon cannot select audit_log');
select tests.expect_denied('select * from public.profiles', 'anon cannot select profiles');
select tests.expect_denied('select * from public.draw_winners', 'anon cannot select draw_winners');
select tests.expect_denied('select * from public.rate_limits', 'anon cannot select rate_limits');
select tests.expect_denied('select attendee_id from public.public_winner_entries', 'anon cannot see winner attendee ids');
select tests.expect_denied($q$insert into public.attendees (pass_code, full_name, mobile, email, gender, age,
  location_city, consent_given, consent_text_version, consent_at)
  values ('PBF-AAAAAA', 'X Y', '+919999999999', 'x@y.zz', 'male', 30, 'Pune', true, 'v1', now())$q$,
  'anon cannot insert attendees');
select tests.expect_denied($q$select public.register_attendee('A B', '9111111111', 'a@b.cc', 'male', 30, 'Pune',
  null, array[current_date], true, 'v1')$q$, 'anon cannot call register_attendee directly');
select tests.expect_denied($q$select public.get_pass('00000000-0000-0000-0000-000000000000')$q$, 'anon cannot call get_pass');
select tests.expect_denied($q$select public.find_pass('9812345621', null, 'asha@example.com')$q$, 'anon cannot call find_pass');
select tests.expect_denied($q$select public.checkin('00000000-0000-0000-0000-000000000000', 'self')$q$, 'anon cannot call checkin');
select tests.expect_denied($q$select public.run_daily_draw(current_date)$q$, 'anon cannot run draw');
select tests.expect_denied($q$select public.admin_kpis()$q$, 'anon cannot read KPIs');
select tests.expect_denied($q$select public.rate_limit_hit('x', 1, 1)$q$, 'anon cannot touch rate limiter');
select tests.expect_denied($q$update public.settings set festival_name = 'Hacked'$q$, 'anon cannot update settings');

do $$ begin
  perform tests.assert((select count(*) from public.settings) = 1, 'anon can read settings');
  perform tests.assert((select count(*) from public.festival_days) = 5, 'anon can read festival days');
  perform tests.assert((select count(*) from public.public_winners) >= 0, 'anon can read public_winners view');
end $$;
reset role;

-- =============================================================================
-- 3. Staff: lookup + scan only; no bulk reads
-- =============================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1"}', true);

do $$
declare r record;
begin
  perform tests.assert((select count(*) from public.attendees) = 0, 'staff sees no attendee rows');
  perform tests.assert((select count(*) from public.checkins) = 0, 'staff sees no check-in rows');
  perform tests.assert((select count(*) from public.audit_log) = 0, 'staff sees no audit rows');
  perform tests.assert((select count(*) from public.profiles) = 1, 'staff sees only own profile');

  select * into r from public.staff_lookup('9812345621');
  perform tests.assert(r.full_name = 'Asha Kulkarni', 'staff lookup by mobile');
  perform tests.assert(r.masked_mobile = '98XXXXXX21', 'staff lookup masks mobile');
  perform tests.assert(r.checked_in_today, 'staff lookup shows today status');
end $$;

select tests.expect_denied($q$select public.get_pass((select id from t_ids where k = 'r1'))$q$, 'staff cannot call get_pass');
select tests.expect_denied($q$select public.register_attendee('A B', '9111111111', 'a@b.cc', 'male', 30, 'Pune',
  null, array[current_date], true, 'v1')$q$, 'staff cannot call register_attendee');

do $$
declare r record; v_code text;
begin
  -- staff learns the code from lookup, then searches by bare code.
  select pass_code into v_code from public.staff_lookup('9700000001');
  select * into r from public.staff_lookup(replace(v_code, 'PBF-', ''));
  perform tests.assert(r.full_name = 'Reader 1', 'staff lookup by bare pass code');

  select * into r from public.checkin((select id from t_ids where k = 'r1'), 'staff', '00000000-0000-0000-0000-0000000000b1', 'ref-0000000001');
  perform tests.assert(r.status = 'checked_in' and r.full_name = 'Reader 1', 'staff scan checks in');
  select * into r from public.checkin((select id from t_ids where k = 'r1'), 'staff', '00000000-0000-0000-0000-0000000000b1', 'ref-0000000002');
  perform tests.assert(r.status = 'already' and r.checkin_at is not null, 'second scan same day says already checked in');
  select * into r from public.checkin((select id from t_ids where k = 'r1'), 'staff', '00000000-0000-0000-0000-0000000000b1', 'ref-0000000001');
  perform tests.assert(r.status = 'already', 'replayed offline scan (same idempotency key) is not double counted');
  perform tests.assert(public.staff_today_count() = 1, 'staff counter shows own check-ins today');
end $$;

select tests.expect_error($q$select public.checkin((select id from t_ids where k = 'r2'), 'staff', '00000000-0000-0000-0000-0000000000b2')$q$,
  'Not authorised', 'staff cannot check in as another staff member');
select tests.expect_error($q$select public.checkin((select id from t_ids where k = 'r2'), 'self')$q$,
  'Not authorised', 'staff cannot record a self check-in');
select tests.expect_error($q$select public.run_daily_draw(public.festival_today())$q$, 'Not authorised', 'staff cannot run draw');
select tests.expect_error($q$select public.admin_kpis()$q$, 'Not authorised', 'staff cannot read KPIs');
select tests.expect_error($q$select public.admin_attendee_search()$q$, 'Not authorised', 'staff cannot search attendees in bulk');
select tests.expect_error($q$select public.log_audit('x', 'y')$q$, 'Not authorised', 'staff cannot write audit');

do $$ begin
  update public.settings set festival_name = 'Hacked by staff';
  perform tests.assert((select festival_name from public.settings) <> 'Hacked by staff', 'staff cannot update settings');
end $$;

-- Offline queue: a scan made yesterday and synced today keeps yesterday's date.
do $$
declare r record;
begin
  select * into r from public.checkin((select id from t_ids where k = 'r2'), 'staff', '00000000-0000-0000-0000-0000000000b1',
    'ref-0000000003', now() - interval '1 day');
  perform tests.assert(r.status = 'checked_in' and r.checkin_date = public.festival_today() - 1,
    'offline scan synced later keeps its scan date');
  select * into r from public.checkin((select id from t_ids where k = 'r3'), 'staff', '00000000-0000-0000-0000-0000000000b1',
    'ref-0000000004', now() - interval '10 days');
  perform tests.assert(r.checkin_date = public.festival_today(), 'implausible scan time falls back to now');
end $$;
reset role;

-- =============================================================================
-- 4. Admin: draw, publish, dashboard, settings
-- =============================================================================
-- Check everyone in today and yesterday (as service_role for speed).
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare v_id uuid;
begin
  for v_id in select t.id from t_ids t loop
    perform public.checkin(v_id, 'self');
    perform public.checkin(v_id, 'self', null, null, now() - interval '1 day');
  end loop;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}', true);

do $$
declare n int; m int; overlap int; d1 date := public.festival_today() - 1; d2 date := public.festival_today();
begin
  perform tests.assert((select count(*) from public.attendees) = 9, 'admin reads all attendees');
  perform tests.assert(public.draw_eligible_count(d1) = 9, 'nine eligible on day 1');

  select count(*) into n from public.run_daily_draw(d1);
  perform tests.assert(n = 5, 'draw picks 5 winners');
  perform tests.assert(public.draw_eligible_count(d2) = 4, 'previous winners not eligible on day 2');

  select count(*) into m from public.run_daily_draw(d2);
  perform tests.assert(m = 4, 'day 2 draw picks only the remaining 4');

  select count(*) into overlap from (
    select attendee_id from public.draw_winners group by attendee_id having count(*) > 1) x;
  perform tests.assert(overlap = 0, 'no one wins twice');
  perform tests.assert(
    (select bool_and(exists (select 1 from public.checkins c join public.draws d on d.draw_date = c.checkin_date
                             where c.attendee_id = w.attendee_id and d.id = w.draw_id)) from public.draw_winners w),
    'every winner checked in on their draw date');
  perform tests.assert((select count(*) from public.audit_log where action = 'draw.run') = 2, 'draws are audited');

  perform public.admin_publish_draw((select id from public.draws where draw_date = d1), true, 'Book hampers');
end $$;

select tests.expect_error($q$select public.run_daily_draw(public.festival_today() - 1)$q$, 'already been run',
  'draw cannot run twice for one date');
select tests.expect_error($q$select public.run_daily_draw(public.festival_today() + 1)$q$, 'No eligible',
  'draw refuses a date with no eligible attendees');

do $$
declare k record;
begin
  select * into k from public.admin_kpis();
  perform tests.assert(k.total_registrations = 9, 'KPI total registrations');
  perform tests.assert(k.today_checkins = 9, 'KPI today check-ins');
  perform tests.assert(k.conversion_rate = 100.0, 'KPI conversion rate');
  perform tests.assert((select sum(expected) from public.admin_daily_stats()) = 11, 'expected footfall sums chosen dates');
  perform tests.assert((select actual from public.admin_daily_stats() where festival_date = public.festival_today()) = 9,
    'actual check-ins per day');
  perform tests.assert((select count(*) from public.admin_breakdown('age_band')) >= 1, 'age band breakdown');
  perform tests.assert((select count(*) from public.admin_attendee_search(p_limit => 3)) = 3, 'search respects limit');
  perform tests.assert(public.admin_attendee_count(p_query => 'Reader') = 8, 'search count by name');
  perform tests.assert(public.admin_attendee_count(p_date => public.festival_today() + 2) = 1, 'filter by chosen date');
end $$;
reset role;

-- Public sees masked winners only, and only published draws.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  perform tests.assert((select count(*) from public.public_winners) = 5, 'only the published draw is public');
  perform tests.assert((select bool_and(masked_mobile ~ '^[6-9][0-9]XXXXXX[0-9]{2}$') from public.public_winners),
    'public winners show masked mobile');
  perform tests.assert((select bool_and(first_name !~ ' ') from public.public_winners), 'public winners show first name only');
end $$;
reset role;

-- Settings save regenerates festival days; dates with registrations are kept but deactivated.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare
  s jsonb := (select to_jsonb(x) from public.settings x);
begin
  perform tests.assert(
    (select count(*) from public.admin_dates_with_registrations_outside(public.festival_today(), public.festival_today() + 1)) = 1,
    'warns about a dropped date with registrations');
  perform public.admin_save_settings(s || jsonb_build_object(
    'start_date', public.festival_today(), 'end_date', public.festival_today() + 1, 'festival_name', 'PBF Test'));
  perform tests.assert((select count(*) from public.festival_days where is_active) = 2, 'only new range is active');
  perform tests.assert(
    (select not is_active from public.festival_days where festival_date = public.festival_today() + 2),
    'dropped date with registrations is deactivated, not deleted');
  perform tests.assert(
    not exists (select 1 from public.festival_days where festival_date = public.festival_today() - 2),
    'unused dropped date is deleted');
  perform tests.assert((select festival_name from public.settings) = 'PBF Test', 'settings updated');
  perform tests.assert(exists (select 1 from public.audit_log where action = 'settings.update'), 'settings change audited');

  perform public.admin_delete_attendee((select id from t_ids where k = 'r8'));
  perform tests.assert((select count(*) from public.attendees) = 8, 'admin can delete an attendee');
  perform tests.assert(not exists (select 1 from public.checkins where attendee_id = (select id from t_ids where k = 'r8')),
    'deleting an attendee removes their check-ins');
end $$;
reset role;

-- Staff limit (3 in this test): two staff exist, a third is fine, a fourth fails.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b3', 'staff3@test.local'),
  ('00000000-0000-0000-0000-0000000000b4', 'staff4@test.local');
insert into public.profiles (id, full_name, email, role)
  values ('00000000-0000-0000-0000-0000000000b3', 'Staff Three', 'staff3@test.local', 'staff');
select tests.expect_error($q$insert into public.profiles (id, full_name, email, role)
  values ('00000000-0000-0000-0000-0000000000b4', 'Staff Four', 'staff4@test.local', 'staff')$q$,
  'Staff limit', 'staff account limit is enforced');

-- Every public table has RLS enabled.
do $$ begin
  perform tests.assert(
    not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
    'RLS enabled on every public table');
end $$;

-- Supabase advisor lints 0028/0029: no SECURITY DEFINER function in the
-- exposed `public` schema may be callable by anon or signed-in users.
do $$
declare offenders text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'));
  perform tests.assert(offenders is null, 'no public security-definer function is callable by anon/authenticated'
    || coalesce(' (found: ' || offenders || ')', ''));
end $$;

\echo 'All database tests passed.'
rollback;
