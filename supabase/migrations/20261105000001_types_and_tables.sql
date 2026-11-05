-- =============================================================================
-- 0001 · Types and core tables
-- Every table enables RLS in the same migration that creates it.
-- Policies live in 20261105000003_rls.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum types (idempotent)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.gender_t as enum ('male', 'female', 'other', 'prefer_not_to_say');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.checkin_method as enum ('staff', 'self');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_type as enum ('organiser', 'sponsor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_tier as enum ('title', 'platinum', 'gold', 'silver', 'partner');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id                    smallint primary key default 1 check (id = 1),
  festival_name         text not null check (char_length(festival_name) between 2 and 120),
  festival_year         integer not null check (festival_year between 2000 and 2200),
  venue                 text not null check (char_length(venue) between 2 and 200),
  start_date            date not null,
  end_date              date not null,
  daily_open_time       time not null,
  daily_close_time      time not null,
  registration_open     boolean not null default true,
  self_checkin_enabled  boolean not null default true,
  draw_winners_per_day  integer not null default 5 check (draw_winners_per_day between 1 and 100),
  staff_limit           integer not null default 10 check (staff_limit between 1 and 200),
  consent_text_version  text not null default 'v1' check (char_length(consent_text_version) between 1 and 20),
  privacy_text          text not null default '',
  contact_email         text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at            timestamptz not null default now(),
  constraint settings_dates_ordered check (end_date >= start_date),
  constraint settings_dates_span check (end_date - start_date <= 60)
);
alter table public.settings enable row level security;

-- ---------------------------------------------------------------------------
-- festival_days (generated from settings by admin_save_settings)
-- ---------------------------------------------------------------------------
create table if not exists public.festival_days (
  id             bigint generated always as identity primary key,
  festival_date  date not null unique,
  is_active      boolean not null default true
);
alter table public.festival_days enable row level security;
create index if not exists festival_days_active_idx on public.festival_days (is_active, festival_date);

-- ---------------------------------------------------------------------------
-- profiles (staff and admins; links to auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 1 and 100),
  email       text not null,
  role        public.app_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index if not exists profiles_role_active_idx on public.profiles (role, is_active);

-- ---------------------------------------------------------------------------
-- attendees
-- ---------------------------------------------------------------------------
create table if not exists public.attendees (
  id                    uuid primary key default gen_random_uuid(),
  pass_code             text not null unique check (pass_code ~ '^PBF-[A-HJ-NP-Z2-9]{6}$'),
  full_name             text not null check (char_length(btrim(full_name)) between 2 and 100),
  mobile                text not null unique check (mobile ~ '^\+91[6-9][0-9]{9}$'),
  email                 text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  gender                public.gender_t not null,
  age                   integer not null check (age between 1 and 120),
  location_city         text not null check (char_length(btrim(location_city)) between 1 and 80),
  location_area         text check (location_area is null or char_length(location_area) <= 80),
  consent_given         boolean not null check (consent_given),
  consent_text_version  text not null,
  consent_at            timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.attendees enable row level security;
-- mobile and pass_code are indexed through their unique constraints.
create index if not exists attendees_created_idx on public.attendees (created_at, id);
create index if not exists attendees_city_idx on public.attendees (lower(location_city));
create index if not exists attendees_gender_idx on public.attendees (gender);
create index if not exists attendees_age_idx on public.attendees (age);

-- ---------------------------------------------------------------------------
-- attendee_dates
-- ---------------------------------------------------------------------------
create table if not exists public.attendee_dates (
  attendee_id    uuid not null references public.attendees (id) on delete cascade,
  festival_date  date not null references public.festival_days (festival_date)
                   on update cascade on delete restrict,
  primary key (attendee_id, festival_date)
);
alter table public.attendee_dates enable row level security;
create index if not exists attendee_dates_date_idx on public.attendee_dates (festival_date, attendee_id);

-- ---------------------------------------------------------------------------
-- checkins (one per attendee per day)
-- ---------------------------------------------------------------------------
create table if not exists public.checkins (
  id            bigint generated always as identity primary key,
  attendee_id   uuid not null references public.attendees (id) on delete cascade,
  checkin_date  date not null,
  checkin_at    timestamptz not null default now(),
  method        public.checkin_method not null,
  staff_id      uuid references public.profiles (id) on delete set null,
  client_ref    text unique check (client_ref is null or char_length(client_ref) between 8 and 64),
  synced_at     timestamptz not null default now(),
  constraint checkins_one_per_day unique (attendee_id, checkin_date),
  constraint checkins_staff_has_staff_id check (method = 'self' or staff_id is not null)
);
alter table public.checkins enable row level security;
-- (attendee_id, checkin_date) unique index also serves lookups by attendee_id.
create index if not exists checkins_date_idx on public.checkins (checkin_date, attendee_id);
create index if not exists checkins_staff_idx on public.checkins (staff_id, checkin_date);
create index if not exists checkins_at_idx on public.checkins (checkin_at, id);

-- ---------------------------------------------------------------------------
-- draws and draw_winners
-- ---------------------------------------------------------------------------
create table if not exists public.draws (
  id             bigint generated always as identity primary key,
  draw_date      date not null unique,
  drawn_by       uuid references public.profiles (id) on delete set null,
  drawn_at       timestamptz not null default now(),
  winners_count  integer not null default 0,
  published_at   timestamptz,
  prize_note     text check (prize_note is null or char_length(prize_note) <= 200)
);
alter table public.draws enable row level security;
create index if not exists draws_drawn_by_idx on public.draws (drawn_by);

create table if not exists public.draw_winners (
  draw_id      bigint not null references public.draws (id) on delete cascade,
  attendee_id  uuid not null unique references public.attendees (id) on delete cascade,
  position     integer not null check (position between 1 and 100),
  primary key (draw_id, position)
);
alter table public.draw_winners enable row level security;

-- Masked, public-safe copy of published winners. Filled by admin_publish_draw.
create table if not exists public.public_winner_entries (
  draw_id       bigint not null references public.draws (id) on delete cascade,
  attendee_id   uuid not null references public.attendees (id) on delete cascade,
  draw_date     date not null,
  position      integer not null,
  first_name    text not null,
  masked_mobile text not null,
  primary key (draw_id, position)
);
alter table public.public_winner_entries enable row level security;
create index if not exists public_winner_entries_attendee_idx on public.public_winner_entries (attendee_id);
create index if not exists public_winner_entries_date_idx on public.public_winner_entries (draw_date desc, position);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null check (char_length(action) between 1 and 64),
  entity      text not null check (char_length(entity) between 1 and 64),
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);

-- ---------------------------------------------------------------------------
-- rate_limits (vendor-neutral, table-based fixed-window limiter)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- partners (organisers and sponsors)
-- ---------------------------------------------------------------------------
create table if not exists public.partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  type           public.partner_type not null,
  tier           public.partner_tier not null default 'partner',
  logo_path      text not null,
  banner_path    text,
  website_url    text check (website_url is null or website_url ~* '^https?://'),
  tagline        text check (tagline is null or char_length(tagline) <= 160),
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  show_on        text[] not null default array['home', 'footer']::text[],
  festival_year  integer not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint partners_show_on_valid check (
    show_on <@ array['home', 'header', 'footer', 'pass', 'checkin_success', 'winners', 'reports', 'venue_qr']::text[]
  )
);
alter table public.partners enable row level security;
create index if not exists partners_active_order_idx on public.partners (is_active, type, tier, display_order);

-- ---------------------------------------------------------------------------
-- key_people (organisers' photographs)
-- ---------------------------------------------------------------------------
create table if not exists public.key_people (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null check (char_length(full_name) between 1 and 120),
  designation       text not null check (char_length(designation) between 1 and 160),
  organisation      text check (organisation is null or char_length(organisation) <= 160),
  photo_path        text,
  short_message     text check (short_message is null or char_length(short_message) <= 300),
  display_order     integer not null default 0,
  is_featured       boolean not null default false,
  show_on           text[] not null default array['home', 'about']::text[],
  festival_year     integer not null,
  is_active         boolean not null default true,
  photo_consent     boolean not null default false,
  photo_consent_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint key_people_show_on_valid check (
    show_on <@ array['home', 'about', 'pass', 'checkin_success', 'reports']::text[]
  ),
  -- A photo may only be stored once the person's agreement is recorded.
  constraint key_people_photo_needs_consent check (
    photo_path is null or (photo_consent and photo_consent_at is not null)
  )
);
alter table public.key_people enable row level security;
create index if not exists key_people_active_order_idx on public.key_people (is_active, is_featured desc, display_order);
