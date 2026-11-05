'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthError, assertStaff } from '@/lib/auth';
import { log } from '@/lib/logger';
import { fail, ok, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | undefined, fallback: string) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) return fail('staff.loginError');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    log.warn('staff.login.failed');
    return fail('staff.loginError');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return fail('staff.loginError');
  }

  log.info('staff.login', { role: profile.role });
  redirect(
    safeNext(parsed.data.next, profile.role === 'admin' ? '/admin/dashboard' : '/staff/scan'),
  );
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/staff/login');
}

export type LookupResult = {
  attendeeId: string;
  fullName: string;
  passCode: string;
  maskedMobile: string;
  dates: string[];
  checkedInToday: boolean;
  checkedInAt: string | null;
};

export async function staffLookupAction(query: string): Promise<ActionResult<LookupResult | null>> {
  try {
    await assertStaff();
  } catch (err) {
    return fail(err instanceof AuthError ? 'errors.unauthorised' : 'errors.generic');
  }
  const q = z.string().trim().min(3).max(20).safeParse(query);
  if (!q.success) return ok(null);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('staff_lookup', { p_query: q.data });
  if (error) {
    log.error('staff.lookup', error, { code: error.code });
    return fail('errors.generic');
  }
  const row = data?.[0];
  if (!row) return ok(null);
  return ok({
    attendeeId: row.attendee_id,
    fullName: row.full_name,
    passCode: row.pass_code,
    maskedMobile: row.masked_mobile,
    dates: row.dates ?? [],
    checkedInToday: row.checked_in_today,
    checkedInAt: row.checked_in_at,
  });
}
