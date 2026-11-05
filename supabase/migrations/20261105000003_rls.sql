-- =============================================================================
-- 0003 · Grants and Row Level Security policies
--
-- Rules:
--   * anon can never read personal data tables directly.
--   * Public writes go through security-definer RPCs (see 0004), which are
--     called from server actions only.
--   * Explicit per-operation policies; auth calls wrapped as (select ...).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table privileges. Supabase grants broad defaults to anon/authenticated;
-- tighten them so RLS is a second line of defence, not the only one.
-- ---------------------------------------------------------------------------
revoke all on table
  public.attendees, public.attendee_dates, public.checkins, public.draws,
  public.draw_winners, public.audit_log, public.rate_limits, public.profiles,
  public.public_winner_entries
from anon;

revoke all on table public.rate_limits from authenticated;

revoke insert, update, delete, truncate on table
  public.settings, public.festival_days, public.partners, public.key_people
from anon;
grant select on table public.settings, public.festival_days, public.partners, public.key_people to anon;
grant select, insert, update, delete on table
  public.settings, public.festival_days, public.partners, public.key_people,
  public.attendees, public.attendee_dates, public.checkins, public.draws,
  public.draw_winners, public.audit_log, public.profiles
to authenticated;

-- Public winners: anon may read only the masked columns.
revoke all on table public.public_winner_entries from authenticated;
grant select (draw_id, draw_date, position, first_name, masked_mobile)
  on table public.public_winner_entries to anon, authenticated;

-- ---------------------------------------------------------------------------
-- settings: public read (no personal data), admin update.
-- ---------------------------------------------------------------------------
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to anon, authenticated using (true);

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- festival_days: public read, admin write.
-- ---------------------------------------------------------------------------
drop policy if exists festival_days_select on public.festival_days;
create policy festival_days_select on public.festival_days
  for select to anon, authenticated using (true);

drop policy if exists festival_days_insert on public.festival_days;
create policy festival_days_insert on public.festival_days
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists festival_days_update on public.festival_days;
create policy festival_days_update on public.festival_days
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists festival_days_delete on public.festival_days;
create policy festival_days_delete on public.festival_days
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- profiles: a user reads their own row; admins read and manage all.
-- Account creation itself happens server-side with the Admin API.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- attendees, attendee_dates: admin only (staff use staff_lookup RPC).
-- No insert policy: registration goes through register_attendee().
-- ---------------------------------------------------------------------------
drop policy if exists attendees_select on public.attendees;
create policy attendees_select on public.attendees
  for select to authenticated using ((select public.is_admin()));

drop policy if exists attendees_update on public.attendees;
create policy attendees_update on public.attendees
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists attendees_delete on public.attendees;
create policy attendees_delete on public.attendees
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists attendee_dates_select on public.attendee_dates;
create policy attendee_dates_select on public.attendee_dates
  for select to authenticated using ((select public.is_admin()));

drop policy if exists attendee_dates_insert on public.attendee_dates;
create policy attendee_dates_insert on public.attendee_dates
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists attendee_dates_delete on public.attendee_dates;
create policy attendee_dates_delete on public.attendee_dates
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- checkins: admin read/delete. Inserts only through checkin().
-- ---------------------------------------------------------------------------
drop policy if exists checkins_select on public.checkins;
create policy checkins_select on public.checkins
  for select to authenticated using ((select public.is_admin()));

drop policy if exists checkins_delete on public.checkins;
create policy checkins_delete on public.checkins
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- draws / draw_winners: admin read; publish via RPC.
-- ---------------------------------------------------------------------------
drop policy if exists draws_select on public.draws;
create policy draws_select on public.draws
  for select to authenticated using ((select public.is_admin()));

drop policy if exists draws_update on public.draws;
create policy draws_update on public.draws
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists draw_winners_select on public.draw_winners;
create policy draw_winners_select on public.draw_winners
  for select to authenticated using ((select public.is_admin()));

-- public_winner_entries holds masked data only; column grants above restrict
-- which columns anon can read.
drop policy if exists public_winner_entries_select on public.public_winner_entries;
create policy public_winner_entries_select on public.public_winner_entries
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- audit_log: admin read only. Writes through write_audit()/log_audit().
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated using ((select public.is_admin()));

-- rate_limits: no policies; reachable only through rate_limit_hit().

-- ---------------------------------------------------------------------------
-- partners and key_people: public reads active rows; admins read all, write.
-- ---------------------------------------------------------------------------
drop policy if exists partners_select on public.partners;
create policy partners_select on public.partners
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

drop policy if exists partners_insert on public.partners;
create policy partners_insert on public.partners
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists partners_update on public.partners;
create policy partners_update on public.partners
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists partners_delete on public.partners;
create policy partners_delete on public.partners
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists key_people_select on public.key_people;
create policy key_people_select on public.key_people
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

drop policy if exists key_people_insert on public.key_people;
create policy key_people_insert on public.key_people
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists key_people_update on public.key_people;
create policy key_people_update on public.key_people
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists key_people_delete on public.key_people;
create policy key_people_delete on public.key_people
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Public view of winners (security invoker; reads only masked columns).
-- ---------------------------------------------------------------------------
create or replace view public.public_winners
with (security_invoker = true)
as
  select e.draw_date, e.position, e.first_name, e.masked_mobile
  from public.public_winner_entries e;

grant select on public.public_winners to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper function grants
-- ---------------------------------------------------------------------------
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, anon, service_role;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;
revoke all on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, text, text, text, jsonb) to service_role;
revoke all on function public.log_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.log_audit(text, text, text, jsonb) to authenticated;
revoke all on function public.enforce_staff_limit() from public, anon, authenticated;
revoke all on function public.generate_pass_code() from public, anon, authenticated;
grant execute on function public.generate_pass_code() to service_role;
