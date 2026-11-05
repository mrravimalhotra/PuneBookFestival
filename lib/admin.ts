import 'server-only';
import { AuthError, assertAdmin, type CurrentUser } from '@/lib/auth';
import { log } from '@/lib/logger';
import { fail, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

/**
 * Wraps an admin Server Action: re-checks the admin role on every call and
 * converts thrown errors into typed result objects.
 */
export async function withAdmin<T>(
  name: string,
  fn: (ctx: {
    user: CurrentUser;
    supabase: Awaited<ReturnType<typeof createClient>>;
  }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let user: CurrentUser;
  try {
    user = await assertAdmin();
  } catch (err) {
    return fail(
      err instanceof AuthError && err.status === 403
        ? 'You need admin access.'
        : 'Please sign in again.',
    );
  }
  try {
    return await fn({ user, supabase: await createClient() });
  } catch (err) {
    // Next.js redirects/notFound are thrown as errors; let them propagate.
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    log.error(`admin.${name}`, err);
    return fail('Something went wrong. Please try again.');
  }
}

export async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc('log_audit', {
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId ?? undefined,
    p_details: details as never,
  });
  if (error) log.warn('audit.write', { code: error.code });
}
