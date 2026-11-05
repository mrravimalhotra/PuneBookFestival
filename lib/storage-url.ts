import { publicEnv } from '@/lib/env-public';

export const PARTNER_BUCKET = 'partner-logos';
export const PEOPLE_BUCKET = 'people-photos';

/** Public URL for an object in a public Supabase Storage bucket. */
export function storageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Photos are stored as `<id>/<version>` with -square.webp and -wide.webp variants. */
export function personPhotoUrl(
  photoPath: string | null | undefined,
  variant: 'square' | 'wide' = 'square',
) {
  return photoPath ? storageUrl(PEOPLE_BUCKET, `${photoPath}-${variant}.webp`) : null;
}

export function partnerLogoUrl(logoPath: string | null | undefined) {
  return storageUrl(PARTNER_BUCKET, logoPath);
}
