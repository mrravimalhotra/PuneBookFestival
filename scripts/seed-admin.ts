/**
 * Creates (or promotes) the first admin from ADMIN_BOOTSTRAP_EMAIL.
 *   pnpm seed:admin
 * Uses the service role key from the environment (.env.local is loaded).
 * Password: ADMIN_BOOTSTRAP_PASSWORD, or a strong random one printed once.
 */
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!url || !key || !email) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_BOOTSTRAP_EMAIL.',
    );
  }
  const generated = !process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const password =
    process.env.ADMIN_BOOTSTRAP_PASSWORD ?? `${randomBytes(12).toString('base64url')}9a`;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | undefined;
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Festival Admin' },
  });
  if (created.data.user) {
    userId = created.data.user.id;
    console.log(`Created auth user ${email}`);
  } else {
    // Already exists: find it and leave the password unchanged.
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    userId = profile?.id;
    if (!userId) throw new Error(`Could not create ${email}: ${created.error?.message}`);
    console.log(`User ${email} already exists; ensuring admin role.`);
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email, full_name: 'Festival Admin', role: 'admin', is_active: true },
      { onConflict: 'id' },
    );
  if (error) throw new Error(`Could not write profile: ${error.message}`);

  console.log(`✔ ${email} is an admin.`);
  if (created.data.user && generated) {
    console.log(`  Temporary password (shown once): ${password}`);
    console.log(
      '  Sign in at /staff/login and change it by asking another admin to reset it, or set ADMIN_BOOTSTRAP_PASSWORD.',
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
