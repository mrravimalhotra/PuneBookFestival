import { z } from 'zod';
import { AuthError, assertStaff } from '@/lib/auth';
import { log } from '@/lib/logger';
import { isSameOrigin } from '@/lib/same-origin';
import { createClient } from '@/lib/supabase/server';
import { verifyPassToken } from '@/lib/tokens';
import type { CheckinResultItem } from '@/lib/staff/checkin-types';

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        clientRef: z.string().min(8).max(64),
        token: z.string().max(64).optional(),
        attendeeId: z.uuid().optional(),
        scannedAt: z.iso.datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Staff check-ins: live scans (one item) and offline-queue replays (batches).
 * Idempotent: each item carries a client idempotency key, and the database
 * allows one check-in per attendee per day.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'forbidden' }, { status: 403 });

  let user;
  try {
    user = await assertStaff();
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return Response.json({ error: 'unauthorised' }, { status });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });

  const supabase = await createClient();
  const results: CheckinResultItem[] = [];

  for (const item of parsed.data.items) {
    const attendeeId = item.attendeeId ?? verifyPassToken(item.token);
    if (!attendeeId) {
      results.push({ clientRef: item.clientRef, status: 'invalid', final: true });
      continue;
    }
    const { data, error } = await supabase.rpc('checkin', {
      p_attendee_id: attendeeId,
      p_method: 'staff',
      p_staff_id: user.id,
      p_client_ref: item.clientRef,
      p_scanned_at: item.scannedAt,
    });
    if (error) {
      log.error('staff.checkin', error, { code: error.code });
      results.push({ clientRef: item.clientRef, status: 'error', final: false });
      continue;
    }
    const row = data?.[0];
    if (!row || row.status === 'not_found') {
      results.push({ clientRef: item.clientRef, status: 'not_found', final: true });
      continue;
    }
    results.push({
      clientRef: item.clientRef,
      status: row.status === 'checked_in' ? 'checked_in' : 'already',
      final: true,
      name: row.full_name,
      checkinAt: row.checkin_at,
      checkinDate: row.checkin_date,
    });
  }

  if (parsed.data.items.length > 1)
    log.info('staff.checkin.batch', { count: parsed.data.items.length });
  const { data: todayCount } = await supabase.rpc('staff_today_count');
  return Response.json(
    { results, todayCount: todayCount ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
