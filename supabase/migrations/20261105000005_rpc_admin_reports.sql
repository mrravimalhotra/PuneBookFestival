-- =============================================================================
-- 0005 · Admin dashboard and report RPCs
-- All aggregates are computed in SQL (no N+1). Every function checks
-- is_admin() before returning anything.
-- =============================================================================

create index if not exists attendees_age_band_idx on public.attendees (public.age_band(age));

create or replace function public.admin_kpis()
returns table (
  total_registrations integer, today_checkins integer, total_checkins integer,
  unique_attendees_checked_in integer, conversion_rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_reg integer;
  v_uniq integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select count(*)::integer into v_reg from public.attendees;
  select count(distinct c.attendee_id)::integer into v_uniq from public.checkins c;
  return query select
    v_reg,
    (select count(*)::integer from public.checkins c where c.checkin_date = public.festival_today()),
    (select count(*)::integer from public.checkins),
    v_uniq,
    case when v_reg = 0 then 0::numeric else pg_catalog.round(v_uniq::numeric * 100 / v_reg, 1) end;
end;
$$;

-- Expected footfall (from chosen dates) vs actual check-ins, per festival day.
create or replace function public.admin_daily_stats()
returns table (
  festival_date date, is_active boolean, expected integer, actual integer,
  staff_checkins integer, self_checkins integer, signups integer
)
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
  with exp as (
    select ad.festival_date d, count(*)::integer n from public.attendee_dates ad group by 1
  ), act as (
    select c.checkin_date d,
           count(*)::integer n,
           count(*) filter (where c.method = 'staff')::integer s,
           count(*) filter (where c.method = 'self')::integer f
    from public.checkins c group by 1
  ), reg as (
    select (a.created_at at time zone 'Asia/Kolkata')::date d, count(*)::integer n
    from public.attendees a group by 1
  )
  select fd.festival_date, fd.is_active,
         coalesce(exp.n, 0), coalesce(act.n, 0), coalesce(act.s, 0), coalesce(act.f, 0),
         coalesce(reg.n, 0)
  from public.festival_days fd
  left join exp on exp.d = fd.festival_date
  left join act on act.d = fd.festival_date
  left join reg on reg.d = fd.festival_date
  order by fd.festival_date;
end;
$$;

-- Registrations per signup day (IST), including days before the festival.
create or replace function public.admin_registrations_per_day()
returns table (signup_date date, registrations integer)
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
  select (a.created_at at time zone 'Asia/Kolkata')::date, count(*)::integer
  from public.attendees a
  group by 1 order by 1;
end;
$$;

-- Breakdown by gender | age_band | city | area. Cities/areas: top 25.
create or replace function public.admin_breakdown(p_dimension text)
returns table (label text, attendees integer, checked_in integer)
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
  if p_dimension not in ('gender', 'age_band', 'city', 'area') then
    raise exception 'Unknown dimension' using errcode = '22023';
  end if;

  return query
  with base as (
    select
      case p_dimension
        when 'gender' then a.gender::text
        when 'age_band' then public.age_band(a.age)
        when 'city' then pg_catalog.initcap(pg_catalog.lower(pg_catalog.btrim(a.location_city)))
        else coalesce(pg_catalog.initcap(pg_catalog.lower(pg_catalog.btrim(a.location_area))), '(not given)')
      end as lbl,
      exists (select 1 from public.checkins c where c.attendee_id = a.id) as came
    from public.attendees a
  )
  select b.lbl, count(*)::integer, (count(*) filter (where b.came))::integer
  from base b
  group by b.lbl
  order by case when p_dimension = 'age_band' then 0 else 1 end,
           case when p_dimension = 'age_band' then pg_catalog.min(
             case b.lbl
               when '12 and under' then 1 when '13–17' then 2 when '18–24' then 3
               when '25–34' then 4 when '35–44' then 5 when '45–59' then 6 else 7 end) end,
           count(*) desc
  limit case when p_dimension in ('city', 'area') then 25 else 100 end;
end;
$$;

-- Check-ins split by method and by staff member.
create or replace function public.admin_checkins_by_staff()
returns table (staff_id uuid, staff_name text, method public.checkin_method, total integer, today integer)
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
  select c.staff_id,
         case when c.method = 'self' then 'Self check-in' else coalesce(p.full_name, '(deleted staff)') end,
         c.method,
         count(*)::integer,
         (count(*) filter (where c.checkin_date = public.festival_today()))::integer
  from public.checkins c
  left join public.profiles p on p.id = c.staff_id
  group by c.staff_id, p.full_name, c.method
  order by count(*) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendee search with filters and keyset pagination on (created_at, id).
-- ---------------------------------------------------------------------------
create or replace function public.admin_attendee_search(
  p_query text default null,
  p_date date default null,
  p_gender public.gender_t default null,
  p_age_band text default null,
  p_city text default null,
  p_after_created timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid, pass_code text, full_name text, mobile text, email text, gender public.gender_t,
  age integer, age_band text, location_city text, location_area text, created_at timestamptz,
  consent_text_version text, consent_at timestamptz, dates date[], checkin_days integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := nullif(pg_catalog.btrim(coalesce(p_query, '')), '');
  q_mobile text := public.normalise_mobile(q);
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
  select a.id, a.pass_code, a.full_name, a.mobile, a.email, a.gender, a.age,
         public.age_band(a.age), a.location_city, a.location_area, a.created_at,
         a.consent_text_version, a.consent_at,
         coalesce((select pg_catalog.array_agg(ad.festival_date order by ad.festival_date)
                   from public.attendee_dates ad where ad.attendee_id = a.id), '{}'::date[]),
         (select count(*)::integer from public.checkins c where c.attendee_id = a.id)
  from public.attendees a
  where (q is null
         or (q_mobile is not null and a.mobile = q_mobile)
         or a.pass_code = pg_catalog.upper(q)
         or a.full_name ilike '%' || q || '%'
         or a.email = pg_catalog.lower(q))
    and (p_date is null or exists (
          select 1 from public.attendee_dates ad where ad.attendee_id = a.id and ad.festival_date = p_date))
    and (p_gender is null or a.gender = p_gender)
    and (p_age_band is null or public.age_band(a.age) = p_age_band)
    and (p_city is null or pg_catalog.lower(a.location_city) = pg_catalog.lower(pg_catalog.btrim(p_city)))
    and (p_after_created is null or (a.created_at, a.id) > (p_after_created, p_after_id))
  order by a.created_at, a.id
  limit least(greatest(coalesce(p_limit, 50), 1), 5000);
end;
$$;

create or replace function public.admin_attendee_count(
  p_query text default null,
  p_date date default null,
  p_gender public.gender_t default null,
  p_age_band text default null,
  p_city text default null
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := nullif(pg_catalog.btrim(coalesce(p_query, '')), '');
  q_mobile text := public.normalise_mobile(q);
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return (
    select count(*)::integer
    from public.attendees a
    where (q is null
           or (q_mobile is not null and a.mobile = q_mobile)
           or a.pass_code = pg_catalog.upper(q)
           or a.full_name ilike '%' || q || '%'
           or a.email = pg_catalog.lower(q))
      and (p_date is null or exists (
            select 1 from public.attendee_dates ad where ad.attendee_id = a.id and ad.festival_date = p_date))
      and (p_gender is null or a.gender = p_gender)
      and (p_age_band is null or public.age_band(a.age) = p_age_band)
      and (p_city is null or pg_catalog.lower(a.location_city) = pg_catalog.lower(pg_catalog.btrim(p_city)))
  );
end;
$$;

-- Check-in log with keyset pagination on (checkin_at, id).
create or replace function public.admin_checkin_log(
  p_from date default null,
  p_to date default null,
  p_after_at timestamptz default null,
  p_after_id bigint default null,
  p_limit integer default 5000
)
returns table (
  id bigint, checkin_at timestamptz, checkin_date date, method public.checkin_method,
  staff_name text, pass_code text, full_name text
)
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
  select c.id, c.checkin_at, c.checkin_date, c.method,
         case when c.method = 'self' then null else coalesce(p.full_name, '(deleted staff)') end,
         a.pass_code, a.full_name
  from public.checkins c
  join public.attendees a on a.id = c.attendee_id
  left join public.profiles p on p.id = c.staff_id
  where (p_from is null or c.checkin_date >= p_from)
    and (p_to is null or c.checkin_date <= p_to)
    and (p_after_at is null or (c.checkin_at, c.id) > (p_after_at, p_after_id))
  order by c.checkin_at, c.id
  limit least(greatest(coalesce(p_limit, 5000), 1), 5000);
end;
$$;

-- Lucky draw winners with full contact details (admin only).
create or replace function public.admin_winners()
returns table (
  draw_id bigint, draw_date date, "position" integer, full_name text, mobile text, email text,
  pass_code text, published boolean, drawn_at timestamptz, drawn_by_name text, prize_note text
)
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
  select d.id, d.draw_date, w.position, a.full_name, a.mobile, a.email, a.pass_code,
         d.published_at is not null, d.drawn_at, p.full_name, d.prize_note
  from public.draws d
  join public.draw_winners w on w.draw_id = d.id
  join public.attendees a on a.id = w.attendee_id
  left join public.profiles p on p.id = d.drawn_by
  order by d.draw_date desc, w.position;
end;
$$;

-- Grants
revoke all on function public.admin_kpis() from public, anon;
grant execute on function public.admin_kpis() to authenticated;
revoke all on function public.admin_daily_stats() from public, anon;
grant execute on function public.admin_daily_stats() to authenticated;
revoke all on function public.admin_registrations_per_day() from public, anon;
grant execute on function public.admin_registrations_per_day() to authenticated;
revoke all on function public.admin_breakdown(text) from public, anon;
grant execute on function public.admin_breakdown(text) to authenticated;
revoke all on function public.admin_checkins_by_staff() from public, anon;
grant execute on function public.admin_checkins_by_staff() to authenticated;
revoke all on function public.admin_attendee_search(text, date, public.gender_t, text, text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.admin_attendee_search(text, date, public.gender_t, text, text, timestamptz, uuid, integer) to authenticated;
revoke all on function public.admin_attendee_count(text, date, public.gender_t, text, text) from public, anon;
grant execute on function public.admin_attendee_count(text, date, public.gender_t, text, text) to authenticated;
revoke all on function public.admin_checkin_log(date, date, timestamptz, bigint, integer) from public, anon;
grant execute on function public.admin_checkin_log(date, date, timestamptz, bigint, integer) to authenticated;
revoke all on function public.admin_winners() from public, anon;
grant execute on function public.admin_winners() to authenticated;
