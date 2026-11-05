-- =============================================================================
-- 0008 · Faster demographic breakdown at 1 lakh+ attendees
-- Replaces a per-row EXISTS with one hash join on distinct checked-in ids.
-- =============================================================================
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
  with came as (
    select distinct c.attendee_id from public.checkins c
  ), base as (
    select
      case p_dimension
        when 'gender' then a.gender::text
        when 'age_band' then public.age_band(a.age)
        when 'city' then pg_catalog.initcap(pg_catalog.lower(pg_catalog.btrim(a.location_city)))
        else coalesce(pg_catalog.initcap(pg_catalog.lower(pg_catalog.btrim(a.location_area))), '(not given)')
      end as lbl,
      (came.attendee_id is not null) as came
    from public.attendees a
    left join came on came.attendee_id = a.id
  )
  select b.lbl, count(*)::integer, (count(*) filter (where b.came))::integer
  from base b
  group by b.lbl
  order by case when p_dimension = 'age_band' then pg_catalog.min(
             case b.lbl
               when '12 and under' then 1 when '13–17' then 2 when '18–24' then 3
               when '25–34' then 4 when '35–44' then 5 when '45–59' then 6 else 7 end) end,
           count(*) desc
  limit case when p_dimension in ('city', 'area') then 25 else 100 end;
end;
$$;

revoke all on function public.admin_breakdown(text) from public, anon;
grant execute on function public.admin_breakdown(text) to authenticated;
