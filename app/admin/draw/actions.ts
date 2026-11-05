'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAdmin } from '@/lib/admin';
import { revalidatePublic } from '@/lib/revalidate';
import { fail, ok, type ActionResult } from '@/lib/result';

export async function runDrawAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ winners: number }>> {
  const date = z.iso.date().safeParse(formData.get('date'));
  if (!date.success) return fail('Pick a date.');
  if (formData.get('confirm') !== 'on')
    return fail('Tick the confirmation box. The draw can only run once per date.');
  return withAdmin('draw.run', async ({ supabase }) => {
    const { data, error } = await supabase.rpc('run_daily_draw', { p_draw_date: date.data });
    if (error) return fail(error.message);
    revalidatePath('/admin/draw');
    return ok(
      { winners: data?.length ?? 0 },
      `Draw complete: ${data?.length ?? 0} winners picked.`,
    );
  });
}

export async function publishDrawAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.coerce.number().int().positive(),
      publish: z.enum(['true', 'false']),
      prize: z.string().trim().max(200).optional().default(''),
    })
    .safeParse({
      id: formData.get('id'),
      publish: formData.get('publish'),
      prize: formData.get('prize') ?? '',
    });
  if (!parsed.success) return fail('Invalid request.');
  return withAdmin<undefined>('draw.publish', async ({ supabase }) => {
    const { error } = await supabase.rpc('admin_publish_draw', {
      p_draw_id: parsed.data.id,
      p_publish: parsed.data.publish === 'true',
      p_prize_note: parsed.data.prize || undefined,
    });
    if (error) return fail(error.message);
    revalidatePublic('winners');
    revalidatePath('/admin/draw');
    return ok(
      undefined,
      parsed.data.publish === 'true' ? 'Published to /winners.' : 'Unpublished.',
    );
  });
}
