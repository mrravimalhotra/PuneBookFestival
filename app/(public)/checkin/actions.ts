'use server';

import { getPublicSettings } from '@/lib/data/public';
import { log } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { createServiceClient } from '@/lib/supabase/service';
import { signPassToken, verifyPassToken, verifyVenueKey } from '@/lib/tokens';
import { selfCheckinSchema } from '@/lib/validation/pass';

export type SelfCheckinOutcome = {
  status: 'checked_in' | 'already';
  firstName: string;
  checkinAt: string;
  passPath: string;
};

/**
 * Self check-in. Only works with a valid venue key (from the poster QR), and
 * the attendee proves who they are with their saved pass token or with
 * mobile + pass code. Recorded with method = 'self'.
 */
export async function selfCheckinAction(input: unknown): Promise<ActionResult<SelfCheckinOutcome>> {
  if (!(await rateLimit('selfCheckin'))) return fail('checkin.rateLimited');

  const parsed = selfCheckinSchema.safeParse(input);
  if (!parsed.success) return fail('checkin.notFound', fieldErrorsFrom(parsed.error.issues));
  const d = parsed.data;
  if (d.kind === 'details' && d.website) return fail('checkin.notFound');

  const settings = await getPublicSettings();
  if (!settings) return fail('register.error');
  if (!verifyVenueKey(d.key, settings.festival_year)) return fail('checkin.invalidKey');
  if (!settings.self_checkin_enabled) return fail('checkin.disabled');

  const supabase = createServiceClient();
  let attendeeId: string | null = null;
  if (d.kind === 'token') {
    attendeeId = verifyPassToken(d.token);
  } else {
    const { data, error } = await supabase.rpc('find_pass', {
      p_mobile: d.mobile,
      p_pass_code: d.passCode,
      p_email: '',
    });
    if (error) {
      log.error('self_checkin.find', error, { code: error.code });
      return fail('register.error');
    }
    attendeeId = data ?? null;
  }
  if (!attendeeId) return fail('checkin.notFound');

  const { data, error } = await supabase.rpc('checkin', {
    p_attendee_id: attendeeId,
    p_method: 'self',
  });
  if (error) {
    log.error('self_checkin.rpc', error, { code: error.code });
    return fail('register.error');
  }
  const row = data?.[0];
  if (!row || row.status === 'not_found') return fail('checkin.notFound');
  if (row.status === 'disabled') return fail('checkin.disabled');

  log.info('self_checkin', { status: row.status });
  return ok({
    status: row.status as 'checked_in' | 'already',
    firstName: row.full_name.split(/\s+/)[0] ?? '',
    checkinAt: row.checkin_at,
    passPath: `/pass/${signPassToken(attendeeId)}`,
  });
}
