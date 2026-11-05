'use server';

import { log } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { createServiceClient } from '@/lib/supabase/service';
import { signPassToken } from '@/lib/tokens';
import { passLookupSchema } from '@/lib/validation/pass';

/** Mobile + (pass code or email). A phone number alone never reveals a pass. */
export async function findPassAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  if (input && typeof input === 'object' && (input as { website?: unknown }).website)
    return fail('myPass.notFound');
  if (!(await rateLimit('myPass'))) return fail('register.rateLimited');

  const parsed = passLookupSchema.safeParse(input);
  if (!parsed.success) return fail('myPass.notFound', fieldErrorsFrom(parsed.error.issues));

  const { data, error } = await createServiceClient().rpc('find_pass', {
    p_mobile: parsed.data.mobile,
    p_pass_code: parsed.data.passCode ?? '',
    p_email: parsed.data.email ?? '',
  });
  if (error) {
    log.error('my_pass.rpc', error, { code: error.code });
    return fail('register.error');
  }
  if (!data) return fail('myPass.notFound');
  return ok({ redirectTo: `/pass/${signPassToken(data)}` });
}
