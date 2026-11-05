'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit, withAdmin } from '@/lib/admin';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { createServiceClient } from '@/lib/supabase/service';
import { staffCreateSchema, staffPasswordSchema } from '@/lib/validation/admin';

/** Creates a staff login with the Supabase Admin API (service role, server only). */
export async function createStaffAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = staffCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail('Check the highlighted fields.', fieldErrorsFrom(parsed.error.issues));
  return withAdmin<undefined>('staff.create', async ({ supabase }) => {
    const [{ data: s }, { count }] = await Promise.all([
      supabase.from('settings').select('staff_limit').eq('id', 1).single(),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'staff')
        .eq('is_active', true),
    ]);
    if ((count ?? 0) >= (s?.staff_limit ?? 10))
      return fail(`The limit of ${s?.staff_limit ?? 10} active staff accounts is reached.`);

    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    });
    if (error || !data.user) return fail(error?.message ?? 'Could not create the account.');

    const { error: pErr } = await admin
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        role: 'staff',
      });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail(pErr.message);
    }
    await audit(supabase, 'staff.create', 'profiles', data.user.id, { email: parsed.data.email });
    revalidatePath('/admin/staff');
    return ok(undefined, `Created ${parsed.data.email}. Share the password with them securely.`);
  });
}

export async function setStaffActiveAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), active: z.enum(['true', 'false']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail('Invalid request.');
  const active = parsed.data.active === 'true';
  return withAdmin<undefined>('staff.active', async ({ supabase, user }) => {
    if (parsed.data.id === user.id) return fail('You cannot deactivate your own account.');
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: active })
      .eq('id', parsed.data.id);
    if (error) return fail(error.message);
    // Block or restore sign-in at the auth level too.
    await createServiceClient().auth.admin.updateUserById(parsed.data.id, {
      ban_duration: active ? 'none' : '876000h',
    });
    await audit(
      supabase,
      active ? 'staff.reactivate' : 'staff.deactivate',
      'profiles',
      parsed.data.id,
    );
    revalidatePath('/admin/staff');
    return ok(undefined, active ? 'Account reactivated.' : 'Account deactivated.');
  });
}

export async function resetStaffPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = staffPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail('Use at least 10 characters with letters and numbers.');
  return withAdmin<undefined>('staff.reset', async ({ supabase }) => {
    const { error } = await createServiceClient().auth.admin.updateUserById(parsed.data.id, {
      password: parsed.data.password,
    });
    if (error) return fail(error.message);
    await audit(supabase, 'staff.password_reset', 'profiles', parsed.data.id);
    return ok(undefined, 'Password reset.');
  });
}
