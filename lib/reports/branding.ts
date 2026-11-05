import 'server-only';
import sharp from 'sharp';
import {
  getKeyPeople,
  getPartners,
  getPublicSettings,
  type PublicSettings,
} from '@/lib/data/public';
import { log } from '@/lib/logger';
import { partnerLogoUrl, personPhotoUrl } from '@/lib/storage-url';

/** Image for pdfmake: PNG data URL or raw SVG markup. */
export type PdfImage =
  { kind: 'png'; dataUrl: string; width: number; height: number } | { kind: 'svg'; svg: string };

const MAX_BYTES = 1_500_000;

async function fetchImage(url: string | null, maxWidth = 600): Promise<PdfImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('svg') || url.toLowerCase().endsWith('.svg')) {
      // Sanitised at upload; pdfmake renders SVG as vector.
      return { kind: 'svg', svg: buf.toString('utf8') };
    }
    const png = sharp(buf).resize({ width: maxWidth, withoutEnlargement: true }).png();
    const { data, info } = await png.toBuffer({ resolveWithObject: true });
    return {
      kind: 'png',
      dataUrl: `data:image/png;base64,${data.toString('base64')}`,
      width: info.width,
      height: info.height,
    };
  } catch (err) {
    log.warn('reports.image', { reason: err instanceof Error ? err.name : 'unknown' });
    return null;
  }
}

export type Branding = {
  settings: PublicSettings | null;
  organiserLogos: Array<{ name: string; image: PdfImage }>;
  sponsorLogos: Array<{ name: string; image: PdfImage }>;
  featuredPhotos: Array<{ name: string; designation: string; image: PdfImage }>;
};

/** Logos/photos for PDF reports or the venue poster, filtered by placement. */
export async function loadBranding(placement: 'reports' | 'venue_qr'): Promise<Branding> {
  const [settings, partners, people] = await Promise.all([
    getPublicSettings(),
    getPartners(),
    getKeyPeople(),
  ]);
  const pick = (type: 'organiser' | 'sponsor', max: number) =>
    partners.filter((p) => p.type === type && p.show_on.includes(placement)).slice(0, max);

  const load = async (list: ReturnType<typeof pick>) =>
    (
      await Promise.all(
        list.map(async (p) => {
          const image = await fetchImage(partnerLogoUrl(p.logo_path), 400);
          return image ? { name: p.name, image } : null;
        }),
      )
    ).filter((x): x is { name: string; image: PdfImage } => x !== null);

  const photoPeople = people
    .filter((p) => p.is_featured && p.show_on.includes('reports'))
    .slice(0, 4);
  const featuredPhotos = (
    await Promise.all(
      photoPeople.map(async (p) => {
        const image = await fetchImage(personPhotoUrl(p.photo_path, 'square'), 300);
        return image ? { name: p.full_name, designation: p.designation, image } : null;
      }),
    )
  ).filter((x): x is { name: string; designation: string; image: PdfImage } => x !== null);

  const [organiserLogos, sponsorLogos] = await Promise.all([
    load(pick('organiser', 4)),
    load(pick('sponsor', 10)),
  ]);
  return { settings, organiserLogos, sponsorLogos, featuredPhotos };
}
