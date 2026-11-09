# Contributing

## Ground rules

- TypeScript strict, no `any`. Validate every input with Zod on the server, even
  when the client already did. Shared schemas live in `lib/validation/`.
- Server Components by default; add `'use client'` only for forms, the scanner,
  charts and other interactive pieces. Load heavy client libraries with dynamic import.
- Re-check authorisation inside every Server Action and Route Handler
  (`assertStaff()`, `assertAdmin()`, `withAdmin()`), never only in the proxy or UI.
- Secrets stay server-side: import `server-only` in any module that touches
  `SUPABASE_SERVICE_ROLE_KEY`, `PASS_TOKEN_SECRET` or `SELF_CHECKIN_SECRET`.
  Only `NEXT_PUBLIC_*` variables may reach the browser.
- Server Actions return `ActionResult` objects (`lib/result.ts`) rather than throwing.
- Per-user data is never prerendered: per-user Supabase clients call
  `connection()`, and code that catches errors around request data calls
  `unstable_rethrow(err)` first.
- Public, cached reads go in `lib/data/public.ts` with `'use cache'`, an explicit
  `cacheLife` and a `cacheTag`; admin saves call `revalidatePublic(...)`.
- All public and staff UI text goes in `messages/en.json` and is read with `t()`.
- Log with `lib/logger.ts`. Never log names, mobiles, emails, tokens or request bodies.
- Accessibility: semantic HTML, a label for every input, keyboard support,
  visible focus, 44 px tap targets, AA contrast.
- Small, single-purpose modules with clear names; don't duplicate logic.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) are enforced by a
Husky `commit-msg` hook, e.g. `feat(register): add area field`,
`fix(scanner): keep camera running after an error`. The pre-commit hook runs
lint-staged (ESLint + Prettier) and the type check.

## Adding a database migration

Migrations are deployed to production automatically by the Supabase GitHub
integration when they reach `main`, so a merged migration is live within minutes.

1. Create a new file. Never edit a migration that has been applied anywhere:
   ```bash
   pnpm exec supabase migration new short_description
   ```
2. Write idempotent SQL where possible (`create ... if not exists`,
   `create or replace function`, `drop policy if exists` + `create policy`).
3. Every new table: `alter table ... enable row level security;` in the same file,
   then explicit policies per operation and role. Wrap auth calls as
   `(select auth.uid())` / `(select private.is_admin())`, and index the columns the
   policies filter on. Never `using (true)` on a table with personal data.
4. Security-definer functions: `set search_path = ''`, fully qualified names,
   `revoke all ... from public, anon` and grant only to the roles that need them.
   If anon or signed-in users must call one, put the implementation in the
   `private` schema (not exposed by the API) and add a `security invoker` wrapper
   with the same name and arguments in `public` (see migration 0009). The SQL
   tests fail if a `public` security-definer function is callable by anon or
   authenticated.
5. Apply it and regenerate types:
   ```bash
   pnpm exec supabase db reset
   ```
   ```bash
   pnpm db:types
   ```
6. Add assertions to `supabase/tests/sql/` and run them:
   ```bash
   pnpm test:db
   ```
7. Check the advisors show no warnings:
   ```bash
   pnpm exec supabase db advisors --type all --level warn
   ```

## Pull requests merge automatically

When the **CI** workflow passes on a pull request into `main`, the
**Auto-merge** workflow merges it, and the Supabase GitHub integration then
deploys any new migrations to production. So **a green CI means live**:

- Open the PR as a **draft**, or add the **`no-auto-merge`** label, to keep it open.
- Pushing a new commit restarts the wait: only the exact commit CI passed is merged.
- Pull requests from forks are never merged automatically.
- Lighthouse runs in the separate **Performance** workflow; it reports but does not block.

## Before opening a pull request

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

and, with `supabase start` running, `pnpm test:db` and `pnpm test:e2e`.
