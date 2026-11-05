'use server';

import { getPublicSettings } from '@/lib/data/public';
import { log } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { createServiceClient } from '@/lib/supabase/service';
import { signPassToken } from '@/lib/tokens';
import { registerSchema } from '@/lib/validation/register';

type RegisterOutcome = { redirectTo: string } | { alreadyRegistered: true };

export async function registerAction(input: unknown): Promise<ActionResult<RegisterOutcome>> {
  // Honeypot: real people never see or fill the "website" field.
  if (
    input &&
    typeof input === 'object' &&
    'website' in input &&
    (input as { website?: unknown }).website
  ) {
    log.warn('register.honeypot');
    return fail('register.error');
  }

  if (!(await rateLimit('register'))) return fail('register.rateLimited');

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail('register.error', fieldErrorsFrom(parsed.error.issues));
  const d = parsed.data;

  const settings = await getPublicSettings();

  const { data, error } = await createServiceClient().rpc('register_attendee', {
    p_full_name: d.fullName,
    p_mobile: d.mobile,
    p_email: d.email,
    p_gender: d.gender,
    p_age: d.age,
    p_city: d.city,
    p_area: d.area ?? '',
    p_dates: d.dates,
    p_consent: d.consent,
    p_consent_version: settings?.consent_text_version ?? 'v1',
  });

  if (error) {
    log.error('register.rpc', error, { code: error.code });
    return fail('register.error');
  }
  const row = data?.[0];
  switch (row?.status) {
    case 'created':
      log.info('register.created');
      return ok({ redirectTo: `/pass/${signPassToken(row.attendee_id)}?welcome=1` });
    case 'existing':
      return ok({
        redirectTo: `/pass/${signPassToken(row.attendee_id)}?existing=1${row.added_dates > 0 ? '&added=1' : ''}`,
      });
    case 'existing_hidden':
      return ok({ alreadyRegistered: true });
    case 'closed':
      return fail('register.closed');
    case 'invalid_dates':
      return fail('register.error', { dates: 'errors.datesRequired' });
    default:
      return fail('register.error');
  }
}
