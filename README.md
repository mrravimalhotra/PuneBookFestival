# Pune Book Festival — registration, QR passes and attendance

A mobile-first, installable web app for festival registration, QR entry passes,
staff gate scanning, venue self check-in, a daily lucky draw and built-in
reports. Built with Next.js 16 (App Router), Supabase (Postgres + RLS + Auth +
Storage), TypeScript, Tailwind CSS and shadcn/ui-style components.

Nothing in the code is tied to one deployment: the Supabase project, URLs, keys,
festival name, year, dates and hours all come from environment variables or the
admin settings screen.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Run locally](#run-locally)
- [Deploy](#deploy)
- [First-time setup at the festival](#first-time-setup-at-the-festival)
- [Rolling over to next year](#rolling-over-to-next-year)
- [Testing](#testing)
- [Security and privacy](#security-and-privacy)
- [Performance](#performance)
- [Decisions and known limitations](#decisions-and-known-limitations)

## Features

| Area                               | What it does                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Register** (`/register`)         | Name, mobile (+91), email, gender, age, city/area, festival days, consent (versioned + timestamped). Inline validation, honeypot, per-IP rate limit. Same mobile + same email ⇒ shows the existing pass (and adds any new days); same mobile + different email ⇒ "already registered" without revealing the pass.                                               |
| **Pass** (`/pass/[token]`)         | HMAC-signed link; QR holds only that link. Name, pass code, days, today's status, sponsor strip, **Download PNG / PDF**, saved to the phone for offline use. Doubles as the confirmation screen.                                                                                                                                                                |
| **My Pass** (`/my-pass`)           | Mobile **plus** pass code or email (a phone number alone never reveals a pass).                                                                                                                                                                                                                                                                                 |
| **Self check-in** (`/checkin?k=…`) | Only via the signed venue poster QR. One tap with the saved pass, or mobile + pass code. Records `method = self`, once per day (Asia/Kolkata).                                                                                                                                                                                                                  |
| **Winners** (`/winners`)           | Published draws only: first name + masked mobile (`98XXXXXX21`).                                                                                                                                                                                                                                                                                                |
| **Staff scanner** (`/staff/scan`)  | Rear-camera QR scanner that stays running, green/amber/red full-screen feedback with sound and vibration, per-staff counter, manual search by pass code or mobile. **Works offline**: scans queue in IndexedDB and sync later (page retry + Background Sync) with idempotency keys.                                                                             |
| **Admin** (`/admin/*`)             | Dashboard (KPIs, charts, breakdowns), attendees (search, filters, keyset paging, delete on request), lucky draw (once per date, publish), reports (Excel + PDF), settings, staff accounts (limit configurable), sponsors & organisers (logo upload, tiers, placements, drag to reorder), key people (photo crop, consent), venue QR poster (A4 PDF), audit log. |
| **PWA**                            | Manifest + icons + shortcuts, install prompt (Android) / instructions (iOS), offline saved pass, offline fallback page, "new version available" banner.                                                                                                                                                                                                         |

## Architecture

```
app/
  (public)/        home, register, pass/[token], my-pass, saved-pass, checkin, winners, privacy, organisers, offline
  staff/           login, scan (+ server actions)
  admin/           dashboard, attendees, draw, reports, settings, staff, partners, people, venue-qr, audit
  api/staff/checkins       live scans + offline queue replay (JSON, same-origin only)
  api/admin/reports/[r]    streamed Excel / PDF exports
  api/admin/venue-qr       A4 poster PDF
  sw.js/route.ts           service worker (versioned per build)
  manifest.ts
components/        ui (shadcn-style), brand (logos, photos), pass, forms, staff, admin, pwa, site
lib/
  env.ts / env-public.ts   Zod-validated environment (server-only vs public)
  supabase/                server (cookies), browser, service (server-only), public (cached anon) clients + generated types
  validation/              Zod schemas shared by client and server
  tokens.ts                HMAC pass tokens and venue keys
  data/public.ts           'use cache' public reads with cache tags
  reports/                 report definitions, Excel streaming, pdfmake rendering
  sw/source.ts             service worker source
messages/en.json   every public/staff UI string (Marathi = add mr.json)
supabase/
  migrations/              numbered, idempotent SQL (tables, RLS, RPCs, storage)
  tests/sql/               99 SQL assertions incl. "anon/staff cannot read attendees"
scripts/           seed-admin, seed-fake-attendees, generate-icons, DB test runners
tests/unit, tests/e2e      Vitest, Playwright
loadtest/          k6 scripts (gate peak, 1 lakh registrations)
```

**Data flow.** Public reads (settings, days, partners, people, winners) are
cached server-side with `'use cache'` + `cacheTag`, and admin saves call
`updateTag` so changes appear immediately. Public writes go through Server
Actions → Zod → honeypot/rate limit → a security-definer RPC. Staff and admin
use their own Supabase session; RLS and in-function role checks enforce access.

## Run locally

Prerequisites: Node 22, pnpm 10, Docker (for the Supabase CLI).

```bash
pnpm install
```

```bash
pnpm exec supabase start
```

```bash
pnpm exec supabase db reset
```

`db reset` applies every migration in `supabase/migrations/` (which also creates
the default 2026 settings and festival days) and runs `supabase/seed.sql`.

Create `.env.local` from `.env.example`. Take the API URL, anon key and service
role key from `pnpm exec supabase status`, and generate the two secrets:

```bash
openssl rand -base64 48
```

Create the first admin (uses `ADMIN_BOOTSTRAP_EMAIL`, and `ADMIN_BOOTSTRAP_PASSWORD` if set):

```bash
pnpm seed:admin
```

Optionally add ~500 realistic fake attendees for the dashboard and reports:

```bash
pnpm seed:fake
```

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000, and sign in at http://localhost:3000/staff/login.

> The service worker only registers in production builds (`pnpm build && pnpm start`).
> Camera access and service workers need HTTPS everywhere except `localhost`.

## Deploy

Use **separate Supabase projects for preview and production**, each with its own
environment variables. Never point a preview deployment at production data.

### 1. Supabase (hosted)

1. Create a project (for Pune visitors choose **ap-south-1 / Mumbai**).
2. Link it and push the migrations:
   ```bash
   pnpm exec supabase link --project-ref <project-ref>
   ```
   ```bash
   pnpm exec supabase db push
   ```
3. In **Authentication → Providers → Email**, turn **off** "Allow new users to sign up"
   (staff accounts are created by admins only). Keep email confirmation off or on as you prefer;
   staff accounts are created pre-confirmed.
4. Run the advisors and fix any warning before going live:
   ```bash
   pnpm exec supabase db advisors --remote --type all --level warn
   ```
5. Use the **transaction pooler** (Supavisor) connection string for any direct
   database tooling; the app itself talks to Supabase over HTTPS.

### 2. Vercel (recommended)

1. Import the repository. Framework: Next.js. Install command `pnpm install`.
2. Set the environment variables from `.env.example` for **Production** and,
   separately, for **Preview** (pointing at the preview Supabase project).
3. Set the function region to **bom1 (Mumbai)**, next to the database.
4. Optional: enable Speed Insights, or set `NEXT_PUBLIC_WEB_VITALS=true` to log
   Web Vitals through `/api/vitals`.
5. Deploy, then create the first admin by running `pnpm seed:admin` locally with
   the production env vars (or create the user in the dashboard and set
   `profiles.role = 'admin'`).

### 3. Any other Node host or Docker

```bash
pnpm build && pnpm start
```

or with Docker (public variables are inlined at build time, so pass them as build args):

```bash
docker build -t pbf --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... --build-arg NEXT_PUBLIC_APP_URL=https://... .
```

```bash
docker run -p 3000:3000 --env-file .env.production pbf
```

Serve it over **HTTPS** (a reverse proxy such as Caddy or nginx), or the service
worker and the camera will not work. If the proxy sets a different client-IP
header than `x-forwarded-for`, set `CLIENT_IP_HEADER`.

## First-time setup at the festival

1. **Sign in** at `/staff/login` with the bootstrap admin.
2. **Settings** (`/admin/settings`): check name, year, venue, dates, hours,
   winners per day, staff limit, privacy text and contact email. Saving
   regenerates the festival days.
3. **Sponsors & organisers** (`/admin/partners`): upload logos (SVG/PNG/WebP ≤ 1 MB,
   ideally < 200 KB), set tier and placements, drag to order.
4. **Key people** (`/admin/people`): upload photos, crop, tick the consent box,
   mark featured people, add the welcome message.
5. **Staff** (`/admin/staff`): create up to 10 staff logins and share passwords securely.
6. **Venue QR** (`/admin/venue-qr`): download the A4 poster and print it for the entrance.
7. **At the gate**: staff open `/staff/scan` on their phones (install it to the home
   screen), tap _Start camera_, allow camera access. Scans keep working offline and
   sync automatically.
8. **Every evening**: `/admin/draw` → pick the day → tick the confirmation → _Run draw_.
   Contact the winners, then _Publish to /winners_.
9. **Reports**: `/admin/reports` → Excel for full detail, PDF for summaries.

## Rolling over to next year

No code changes:

1. In `/admin/settings`, change the year, dates and hours (and bump the consent
   version if the wording changes). Old days with registrations are kept but hidden.
2. Download a new venue poster: the venue key is signed per festival year, so last
   year's posters stop working automatically.
3. Update sponsors, organisers and key people for the new year (hide last year's).
4. Delete or anonymise last year's attendees according to your privacy notice
   (e.g. export, then delete via SQL or the attendee screen).

## Testing

| Command                | What it runs                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`       | `next typegen` + `tsc --noEmit` (strict)                                                                                                                                    |
| `pnpm lint`            | ESLint (Next, TypeScript, jsx-a11y), zero warnings allowed                                                                                                                  |
| `pnpm test`            | Vitest: Zod schemas, HMAC tokens, upload sanitising, formatting, SW source                                                                                                  |
| `pnpm test:db`         | SQL tests against `supabase start` (RLS, grants, registration, check-in, draw, settings)                                                                                    |
| `pnpm test:db:harness` | Same SQL tests on a throwaway plain Postgres with Supabase stand-ins (no Docker)                                                                                            |
| `pnpm test:e2e`        | Playwright on a mobile profile: registration, duplicates, My Pass, downloads, self check-in, offline pass, staff scans, offline queue sync, admin reports, security headers |
| `pnpm lhci`            | Lighthouse CI with the budgets below                                                                                                                                        |
| `pnpm loadtest`        | k6 gate-peak scenario (see `loadtest/`)                                                                                                                                     |

CI (`.github/workflows/ci.yml`) runs install → type check → lint → format check →
unit tests → build → client-bundle secret scan → `pnpm audit`, then migrations +
SQL tests + Supabase advisors and generated-type drift against a local Supabase,
then Playwright and Lighthouse.

## Security and privacy

- QR codes contain only a signed link (`HMAC-SHA256`, truncated to 96 bits); no personal data.
- The service role key is used only on the server: for the public RPCs (after
  validation and rate limiting) and the Supabase Admin API (creating staff).
  CI fails if a server secret appears in `.next/static`.
- RLS is enabled on every table, with explicit per-operation policies; anon cannot
  read attendees, check-ins, draws, profiles or the audit log (proven by SQL tests).
- Security-definer functions set `search_path = ''`, use qualified names and are
  granted only to the roles that need them.
- Staff see only name, days and today's status for one attendee at a time.
- Rate limiting on register, My Pass and self check-in (table-based, IP hashed).
- Consent text version and timestamp stored per attendee (DPDP Act); admins can
  delete an attendee on request; organiser photo consent is enforced in the database.
- Audit log of settings, staff, partner/people, draw, export and deletion actions.
- Security headers: CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS,
  `Permissions-Policy` (camera allowed only on `/staff/scan`).
- Logs are structured JSON and never include names, mobiles, emails or tokens.

## Performance

Budgets (enforced by Lighthouse CI): LCP < 2.5 s, CLS < 0.1, performance ≥ 90,
< 150 KB gzipped JS on the home and register pages. Measured on a local
production build (Lighthouse 13, mobile emulation with simulated 4G/slow CPU):

| Page        | Performance | LCP   | CLS   | TBT       | JS (gzip) |
| ----------- | ----------- | ----- | ----- | --------- | --------- |
| `/`         | 0.99–1.00   | 0.8 s | 0     | 70–110 ms | 46 KB     |
| `/register` | 0.94        | 0.8 s | 0     | 280 ms    | 41 KB     |
| `/winners`  | 0.98        | 0.8 s | 0.075 | 90 ms     | —         |

(A first, cold request scored lower while caches filled; CI takes the median of 3 runs.)

- Public pages are partially prerendered: the static shell (with cached festival
  data) is served instantly; only personal data streams in.
- Heavy libraries (QR scanner, Recharts, html-to-image, jsPDF) load only on the
  routes that use them; Excel/PDF generation runs on the server only.
- Database at **1 lakh registrations** (plain Postgres 16, small sandbox VM):
  `checkin` at 50/s → average 5.8 ms, 0 failures; unthrottled ≈ 880 check-ins/s.
  KPIs 13 ms, daily stats 45 ms, breakdowns 40–300 ms, attendee page 2 ms.
  Full 1 lakh-row Excel export streams in ≈ 17 s (7.7 MB).
- Before the festival, run `loadtest/k6-checkin.js` and `loadtest/k6-register.js`
  against a **staging** project with production-sized compute and record the p95.

## Decisions and known limitations

- **Duplicate mobile.** The brief says to "show the existing pass", but My Pass
  forbids revealing a pass from a phone number alone. Resolution: the pass is
  shown only when the email also matches; otherwise the visitor is told they're
  registered and sent to My Pass.
- **Public RPCs and the service key.** Registration, pass lookup and self check-in
  RPCs are granted to `service_role` only, so callers holding just the anon key
  cannot bypass the honeypot and rate limiting.
- **Draws are published explicitly.** Admins see full contact details first and
  publish to `/winners` when ready.
- **Age bands** follow the brief, with "12 and under" covering the gap between
  "under 12" and "13–17".
- **Offline scans** keep their scan time (accepted up to 36 hours later), so a
  scan made on Saturday and synced on Sunday still counts for Saturday.
- **Service worker** is hand-written (`lib/sw/source.ts`) rather than Serwist, to
  stay compatible with Turbopack builds without extra plugins.
- **PDF fonts** are Roboto (Latin). Names typed in Devanagari appear correctly in
  the app and Excel, but not in PDFs until a Devanagari font is added to
  `lib/reports/pdf.ts`.
- **Admin screens** are English-only; public and staff screens use `messages/en.json`.
- **Later phase (not built):** email/WhatsApp delivery, SMS, stall discount coupons,
  priority seats, kids' reading passport, Marathi.
