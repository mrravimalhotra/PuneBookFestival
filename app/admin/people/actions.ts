'use server';

import { revalidatePath } from 'next/cache';
import { audit, withAdmin } from '@/lib/admin';
import { revalidatePublic } from '@/lib/revalidate';
import { fail, fieldErrorsFrom, ok, type ActionResult } from '@/lib/result';
import { PEOPLE_BUCKET } from '@/lib/storage-url';
import { preparePhoto, UploadError } from '@/lib/uploads';
import { personSchema, reorderSchema } from '@/lib/validation/admin';

export async function savePersonAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = personSchema.safeParse({
    ...Object.fromEntries(formData),
    show_on: formData.getAll('show_on'),
  });
  if (!parsed.success)
    return fail('Check the highlighted fields.', fieldErrorsFrom(parsed.error.issues));
  const v = parsed.data;
  const photo = formData.get('photo');
  const hasFile = photo instanceof File && photo.size > 0;
  const crop = {
    cx: Number(formData.get('crop_x') ?? 0.5),
    cy: Number(formData.get('crop_y') ?? 0.5),
    zoom: Number(formData.get('crop_zoom') ?? 1),
  };

  if (hasFile && !v.photo_consent)
    return fail('Confirm that this person agreed to have their photo published.');

  return withAdmin<undefined>('person.save', async ({ supabase }) => {
    const id = v.id || crypto.randomUUID();
    const { data: existing } = v.id
      ? await supabase
          .from('key_people')
          .select('photo_path, photo_consent, photo_consent_at')
          .eq('id', v.id)
          .maybeSingle()
      : { data: null };

    let photoPath: string | null | undefined;
    if (hasFile) {
      let out;
      try {
        out = await preparePhoto(photo, crop);
      } catch (err) {
        return fail(
          err instanceof UploadError ? err.message : 'That photo could not be processed.',
        );
      }
      photoPath = `${id}/${Date.now()}`;
      const bucket = supabase.storage.from(PEOPLE_BUCKET);
      const opts = { contentType: 'image/webp', cacheControl: '31536000', upsert: false };
      const [a, b] = await Promise.all([
        bucket.upload(`${photoPath}-square.webp`, out.square, opts),
        bucket.upload(`${photoPath}-wide.webp`, out.wide, opts),
      ]);
      if (a.error || b.error) return fail(`Upload failed: ${(a.error ?? b.error)!.message}`);
    }
    // Withdrawing consent removes the photo from public pages.
    if (!v.photo_consent) photoPath = null;

    const consentAt = v.photo_consent
      ? existing?.photo_consent
        ? existing.photo_consent_at
        : new Date().toISOString()
      : null;
    const row = {
      full_name: v.full_name,
      designation: v.designation,
      organisation: v.organisation || null,
      short_message: v.short_message || null,
      display_order: v.display_order,
      is_featured: v.is_featured,
      is_active: v.is_active,
      show_on: v.show_on,
      festival_year: v.festival_year,
      photo_consent: v.photo_consent,
      photo_consent_at: consentAt,
      ...(photoPath !== undefined ? { photo_path: photoPath } : {}),
    };
    const { error } = v.id
      ? await supabase.from('key_people').update(row).eq('id', v.id)
      : await supabase.from('key_people').insert({ id, ...row });
    if (error) return fail(error.message);

    await audit(supabase, v.id ? 'person.update' : 'person.create', 'key_people', id, {
      photo: hasFile,
      photo_consent: v.photo_consent,
    });
    revalidatePublic('people');
    revalidatePath('/admin/people');
    return ok(undefined, `Saved ${v.full_name}.`);
  });
}

export async function togglePersonAction(id: string, active: boolean): Promise<ActionResult> {
  return withAdmin<undefined>('person.toggle', async ({ supabase }) => {
    const { error } = await supabase.from('key_people').update({ is_active: active }).eq('id', id);
    if (error) return fail(error.message);
    await audit(supabase, active ? 'person.show' : 'person.hide', 'key_people', id);
    revalidatePublic('people');
    revalidatePath('/admin/people');
    return ok(undefined);
  });
}

export async function reorderPeopleAction(ids: string[]): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) return fail('Invalid order.');
  return withAdmin<undefined>('person.reorder', async ({ supabase }) => {
    const results = await Promise.all(
      parsed.data.ids.map((id, i) =>
        supabase
          .from('key_people')
          .update({ display_order: (i + 1) * 10 })
          .eq('id', id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(failed.error.message);
    revalidatePublic('people');
    revalidatePath('/admin/people');
    return ok(undefined);
  });
}
