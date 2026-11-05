import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { AuthError, assertAdmin } from '@/lib/auth';
import { formatDateRange, formatTime } from '@/lib/format';
import { log } from '@/lib/logger';
import { qrPngDataUrl } from '@/lib/qr';
import { loadBranding } from '@/lib/reports/branding';
import { BRAND, getPdfMake, imageNode } from '@/lib/reports/pdf';
import { createClient } from '@/lib/supabase/server';
import { venueCheckinUrl } from '@/lib/venue-qr';

/** Print-ready A4 self check-in poster with festival branding. */
export async function GET() {
  try {
    await assertAdmin();
  } catch (err) {
    return new Response('Forbidden', { status: err instanceof AuthError ? err.status : 401 });
  }

  try {
    const branding = await loadBranding('venue_qr');
    const s = branding.settings;
    if (!s) return new Response('Settings unavailable', { status: 503 });
    const url = venueCheckinUrl(s.festival_year);
    const qr = await qrPngDataUrl(url, 1400);

    const row = (
      items: Array<{ image: Parameters<typeof imageNode>[0] }>,
      fit: [number, number],
    ): Content =>
      ({
        columns: [
          { width: '*', text: '' },
          ...items.map((i) => ({ ...(imageNode(i.image, fit) as object), width: fit[0] + 10 })),
          { width: '*', text: '' },
        ],
        columnGap: 10,
      }) as unknown as Content;

    const content: Content[] = [];
    if (branding.organiserLogos.length)
      content.push(row(branding.organiserLogos, [110, 60]), { text: ' ', margin: [0, 6] });
    content.push(
      {
        text: `${s.festival_name} ${s.festival_year}`,
        fontSize: 30,
        bold: true,
        color: BRAND,
        alignment: 'center',
      },
      {
        text: `${formatDateRange(s.start_date, s.end_date)} · ${formatTime(s.daily_open_time)}–${formatTime(s.daily_close_time)} · ${s.venue}`,
        fontSize: 12,
        alignment: 'center',
        color: '#57534e',
        margin: [0, 4, 0, 18],
      },
      { text: 'SELF CHECK-IN', fontSize: 40, bold: true, alignment: 'center', characterSpacing: 2 },
      {
        text: 'Scan with your phone camera to check in and enter today’s lucky draw',
        fontSize: 15,
        alignment: 'center',
        margin: [0, 6, 0, 14],
      },
      { image: qr, width: 300, alignment: 'center' },
      {
        ol: [
          'Open your phone camera and point it at the code.',
          'Tap the link, then tap “Check in” (or enter your mobile number and pass code).',
          'Not registered yet? Register on the same page in a minute.',
        ],
        fontSize: 13,
        margin: [70, 18, 70, 0],
      },
    );
    if (branding.featuredPhotos.length) {
      content.push({
        columns: [
          { width: '*', text: '' },
          ...branding.featuredPhotos.map((p) => ({
            width: 110,
            stack: [
              { ...(imageNode(p.image, [64, 64]) as object), alignment: 'center' },
              { text: p.name, fontSize: 8, bold: true, alignment: 'center' },
            ],
          })),
          { width: '*', text: '' },
        ],
        margin: [0, 16, 0, 0],
      } as unknown as Content);
    }

    const doc: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [36, 36, 36, 96],
      info: { title: `${s.festival_name} ${s.festival_year} — Self check-in poster` },
      defaultStyle: { font: 'Roboto' },
      content,
      footer: (): Content =>
        branding.sponsorLogos.length
          ? ({
              margin: [36, 0, 36, 0],
              stack: [
                {
                  text: 'SUPPORTED BY',
                  fontSize: 8,
                  bold: true,
                  alignment: 'center',
                  color: '#57534e',
                  margin: [0, 0, 0, 6],
                },
                row(branding.sponsorLogos.slice(0, 6), [70, 36]),
              ],
            } as unknown as Content)
          : { text: '' },
    };
    const pdf = await getPdfMake().createPdf(doc).getBuffer();

    const supabase = await createClient();
    await supabase.rpc('log_audit', {
      p_action: 'venue_qr.download',
      p_entity: 'settings',
      p_entity_id: String(s.festival_year),
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="self-checkin-poster-${s.festival_year}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    log.error('venue_qr.pdf', err);
    return new Response('Poster failed', { status: 500 });
  }
}
