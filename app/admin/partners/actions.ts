'use server';

import { revalidatePath } from 'next/cache';
import { audit, withAdmin } from '@/lib/admin';
import { revalidatePublic } from '@/lib/revalidate';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { PARTNER_BUCKET } from '@/lib/storage-url';
import { prepareLogo, UploadError } from '@/lib/uploads';
import { partnerSchema, reorderSchema } from '@/lib/validation/admin';

export async function savePartnerAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = partnerSchema.safeParse({
    ...Object.fromEntries(formData),
    show_on: formData.getAll('show_on'),
  });
  if (!parsed.success)
    return fail('Check the highlighted fields.', fieldErrorsFrom(parsed.error.issues));
  const v = parsed.data;
  const logo = formData.get('logo');
  const hasFile = logo instanceof File && logo.size > 0;

  return withAdmin<undefined>('partner.save', async ({ supabase }) => {
    const id = v.id || crypto.randomUUID();
    let logoPath: string | undefined;
    let warning = '';
    if (hasFile) {
      let prepared;
      try {
        prepared = await prepareLogo(logo);
      } catch (err) {
        return fail(err instanceof UploadError ? err.message : 'That file could not be processed.');
      }
      logoPath = `${id}/${Date.now()}.${prepared.ext}`;
      const { error } = await supabase.storage
        .from(PARTNER_BUCKET)
        .upload(logoPath, prepared.body, {
          contentType: prepared.contentType,
          cacheControl: '31536000',
          upsert: false,
        });
      if (error) return fail(`Upload failed: ${error.message}`);
      if (prepared.large) warning = ' The logo is over 200 KB — a smaller file will load faster.';
    } else if (!v.id) {
      return fail('Please choose a logo file.');
    }

    const row = {
      name: v.name,
      type: v.type,
      tier: v.tier,
      website_url: v.website_url || null,
      tagline: v.tagline || null,
      display_order: v.display_order,
      is_active: v.is_active,
      show_on: v.show_on,
      festival_year: v.festival_year,
      ...(logoPath ? { logo_path: logoPath } : {}),
    };
    const { error } = v.id
      ? await supabase.from('partners').update(row).eq('id', v.id)
      : await supabase.from('partners').insert({ id, ...row, logo_path: logoPath! });
    if (error) return fail(error.message);

    await audit(supabase, v.id ? 'partner.update' : 'partner.create', 'partners', id, {
      name: v.name,
      logo: Boolean(logoPath),
    });
    revalidatePublic('partners');
    revalidatePath('/admin/partners');
    return ok(undefined, `Saved ${v.name}.${warning}`);
  });
}

export async function togglePartnerAction(id: string, active: boolean): Promise<ActionResult> {
  return withAdmin<undefined>('partner.toggle', async ({ supabase }) => {
    const { error } = await supabase.from('partners').update({ is_active: active }).eq('id', id);
    if (error) return fail(error.message);
    await audit(supabase, active ? 'partner.show' : 'partner.hide', 'partners', id);
    revalidatePublic('partners');
    revalidatePath('/admin/partners');
    return ok(undefined);
  });
}

export async function reorderPartnersAction(ids: string[]): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) return fail('Invalid order.');
  return withAdmin<undefined>('partner.reorder', async ({ supabase }) => {
    const results = await Promise.all(
      parsed.data.ids.map((id, i) =>
        supabase
          .from('partners')
          .update({ display_order: (i + 1) * 10 })
          .eq('id', id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(failed.error.message);
    revalidatePublic('partners');
    revalidatePath('/admin/partners');
    return ok(undefined);
  });
}
