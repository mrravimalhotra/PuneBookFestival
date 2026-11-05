-- =============================================================================
-- 0007 · Default settings row and festival days
-- Only inserted when absent, so re-running never overwrites admin changes.
-- Change everything later from /admin/settings — no code changes needed.
-- =============================================================================

insert into public.settings (
  id, festival_name, festival_year, venue, start_date, end_date,
  daily_open_time, daily_close_time, registration_open, self_checkin_enabled,
  draw_winners_per_day, staff_limit, consent_text_version, privacy_text
) values (
  1, 'Pune Book Festival', 2026, 'Fergusson College, Pune', date '2026-12-12', date '2026-12-20',
  time '11:00', time '20:00', true, true, 5, 10, 'v1',
  $privacy$We collect your name, mobile number, email address, gender, age, city/area and the festival days you plan to visit.

Why: to issue your entry pass, manage entry at the gate, count attendance, run the daily lucky draw and contact winners.

How long: we keep registration data until 90 days after the festival ends, then delete it or keep only anonymous totals.

Your rights: you can ask us to correct or delete your details at any time.

Contact: write to the organisers at the email address shown below.$privacy$
)
on conflict (id) do nothing;

insert into public.festival_days (festival_date, is_active)
select d::date, true
from public.settings s,
     lateral pg_catalog.generate_series(s.start_date, s.end_date, interval '1 day') d
where s.id = 1
on conflict (festival_date) do nothing;
