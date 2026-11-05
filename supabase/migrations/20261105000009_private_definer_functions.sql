-- =============================================================================
-- 0009 · Move SECURITY DEFINER functions out of the exposed API schema
--
-- Supabase's advisors (lints 0028/0029) flag security-definer functions in
-- `public` that anon/authenticated can call over /rest/v1/rpc. Each of these
-- already checks the caller's role, but the recommended hardening is:
--   * the privileged implementation lives in `private` (not exposed by the API)
--   * `public` keeps a SECURITY INVOKER wrapper with the same name and
--     arguments, so the app and generated types do not change.
-- RLS policies reference functions by OID, so they follow the move.
-- Idempotent: safe to run again.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

do $$
declare
  -- Functions to move. is_admin/is_staff are used by RLS policies only (no wrapper).
  fns constant text[] := array[
    'is_admin()', 'is_staff()',
    'log_audit(text, text, text, jsonb)',
    'checkin(uuid, public.checkin_method, uuid, text, timestamptz)',
    'staff_lookup(text)', 'staff_today_count()',
    'draw_eligible_count(date)', 'run_daily_draw(date)',
    'admin_publish_draw(bigint, boolean, text)',
    'admin_dates_with_registrations_outside(date, date)',
    'admin_save_settings(jsonb)', 'admin_delete_attendee(uuid)',
    'admin_kpis()', 'admin_daily_stats()', 'admin_registrations_per_day()',
    'admin_breakdown(text)', 'admin_checkins_by_staff()',
    'admin_attendee_search(text, date, public.gender_t, text, text, timestamptz, uuid, integer)',
    'admin_attendee_count(text, date, public.gender_t, text, text)',
    'admin_checkin_log(date, date, timestamptz, bigint, integer)',
    'admin_winners()'
  ];
  no_wrapper constant text[] := array['is_admin', 'is_staff'];
  sig text;
  fname text;
  pub regprocedure;
  priv regprocedure;
  def text;
  p record;
  call_args text;
begin
  -- 1. Move each security-definer implementation into private.
  foreach sig in array fns loop
    fname := split_part(sig, '(', 1);
    pub := to_regprocedure('public.' || sig);
    priv := to_regprocedure('private.' || sig);
    if pub is not null and priv is null
       and (select prosecdef from pg_proc where oid = pub) then
      execute format('alter function %s set schema private', pub);
    end if;
  end loop;

  -- 2. Bodies call is_admin()/is_staff() by qualified name: point them at private.
  for p in
    select pr.oid from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'private'
      -- CASE guards pg_get_functiondef from ever seeing aggregates.
      and case when pr.prokind = 'f'
               then pg_get_functiondef(pr.oid) ~ 'public\.is_(admin|staff)\(\)'
               else false end
  loop
    def := pg_get_functiondef(p.oid);
    def := replace(def, 'public.is_admin()', 'private.is_admin()');
    def := replace(def, 'public.is_staff()', 'private.is_staff()');
    execute def;
  end loop;

  -- 3. Public SECURITY INVOKER wrappers with identical signatures.
  for p in
    select pr.oid, pr.proname, pr.proretset, pr.proargnames, pr.pronargs,
           pg_get_function_arguments(pr.oid) as args,
           pg_get_function_identity_arguments(pr.oid) as ident_args,
           pg_get_function_result(pr.oid) as result
    from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'private' and pr.prokind = 'f' and pr.proname <> all (no_wrapper)
  loop
    select coalesce(string_agg(format('%1$I => %1$I', a), ', '), '')
      into call_args
      from unnest((p.proargnames)[1:p.pronargs]) as a;

    execute format(
      'create or replace function public.%1$I(%2$s) returns %3$s
         language sql security invoker set search_path = ''''
       as $w$ select %4$s private.%1$I(%5$s) $w$',
      p.proname, p.args, p.result,
      case when p.proretset or p.result like 'TABLE(%' then '* from' else '' end,
      call_args
    );

    -- Same audience as the implementation.
    execute format('revoke all on function public.%I(%s) from public, anon', p.proname, p.ident_args);
    execute format('grant execute on function public.%I(%s) to authenticated', p.proname, p.ident_args);
    if p.proname = 'checkin' then
      execute format('grant execute on function public.%I(%s) to service_role', p.proname, p.ident_args);
    end if;
  end loop;
end $$;

-- Policy helpers stay callable from RLS for every role that has policies using them.
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_staff() to authenticated, service_role;
