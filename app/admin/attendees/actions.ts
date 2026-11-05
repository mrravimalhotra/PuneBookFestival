'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { withAdmin } from '@/lib/admin';
import { revalidatePublic } from '@/lib/revalidate';
import { fail, ok, type ActionResult } from '@/lib/result';

/** Deletes an attendee on request (DPDP). Cascades to dates, check-ins and wins. */
export async function deleteAttendeeAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success || formData.get('confirm') !== 'DELETE') return fail('Type DELETE to confirm.');
  const res = await withAdmin<undefined>('attendee.delete', async ({ supabase }) => {
    const { error } = await supabase.rpc('admin_delete_attendee', { p_attendee_id: id.data });
    if (error) return fail(error.message);
    revalidatePublic('winners');
    return ok(undefined);
  });
  if (res.ok) redirect('/admin/attendees?deleted=1');
  return res;
}
