'use server';

import { revalidatePath } from 'next/cache';
import { withAdmin } from '@/lib/admin';
import { formatDay } from '@/lib/format';
import { revalidatePublic } from '@/lib/revalidate';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { settingsSchema } from '@/lib/validation/admin';

export async function saveSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe = fieldErrorsFrom(parsed.error.issues);
    return fail(`Please fix: ${Object.keys(fe).join(', ')}`, fe);
  }
  const { confirm_drop_dates, ...values } = parsed.data;

  return withAdmin<undefined>('settings.save', async ({ supabase }) => {
    const { data: affected, error: e1 } = await supabase.rpc(
      'admin_dates_with_registrations_outside',
      {
        p_start: values.start_date,
        p_end: values.end_date,
      },
    );
    if (e1) return fail(e1.message);
    if (affected?.length && !confirm_drop_dates) {
      const list = affected
        .map((d) => `${formatDay(d.festival_date)} (${d.registrations})`)
        .join(', ');
      return fail(
        `These dates already have registrations and will be hidden from the form: ${list}. Tick “I understand” and save again to continue.`,
      );
    }
    const { error } = await supabase.rpc('admin_save_settings', { p: values });
    if (error) return fail(error.message);
    revalidatePublic('settings', 'days');
    revalidatePath('/admin', 'layout');
    return ok(undefined, 'Settings saved. Public pages are updated.');
  });
}
