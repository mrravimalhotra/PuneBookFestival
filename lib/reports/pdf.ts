import 'server-only';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatDateRange, formatDateTime } from '@/lib/format';
import type { Branding, PdfImage } from './branding';

const require = createRequire(import.meta.url);

type PdfMake = {
  addFonts: (fonts: Record<string, Record<string, string>>) => void;
  setUrlAccessPolicy: (cb: (url: string) => boolean) => void;
  setLocalAccessPolicy: (cb: (p: string) => boolean) => void;
  createPdf: (doc: TDocumentDefinitions) => { getBuffer: () => Promise<Buffer> };
};

let instance: PdfMake | null = null;

/** pdfmake configured with bundled Roboto fonts; network and other file access denied. */
function pdfmake(): PdfMake {
  if (instance) return instance;
  const pm = require('pdfmake') as PdfMake;
  const fontDir = path.join(
    path.dirname(require.resolve('pdfmake/package.json')),
    'fonts',
    'Roboto',
  );
  pm.addFonts({
    Roboto: {
      normal: path.join(fontDir, 'Roboto-Regular.ttf'),
      bold: path.join(fontDir, 'Roboto-Medium.ttf'),
      italics: path.join(fontDir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
    },
  });
  pm.setUrlAccessPolicy(() => false);
  pm.setLocalAccessPolicy((p) => path.resolve(p).startsWith(fontDir));
  instance = pm;
  return pm;
}

export function imageNode(img: PdfImage, fit: [number, number]): Content {
  return img.kind === 'svg' ? { svg: img.svg, fit } : { image: img.dataUrl, fit };
}

export const BRAND = '#891a27';

/** Max rows in a PDF table; the Excel download holds the full detail. */
export const PDF_ROW_CAP = 2000;

/**
 * Branded report PDF: organiser logos in the header, sponsor logos in the
 * footer, festival name, date range and a generated-at timestamp.
 */
export async function renderReportPdf(opts: {
  title: string;
  branding: Branding;
  body: Content[];
  landscape?: boolean;
}): Promise<Buffer> {
  const { settings, organiserLogos, sponsorLogos } = opts.branding;
  const festival = settings ? `${settings.festival_name} ${settings.festival_year}` : '';
  const range = settings ? formatDateRange(settings.start_date, settings.end_date) : '';
  const generated = `Generated ${formatDateTime(new Date())} IST`;

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: opts.landscape ? 'landscape' : 'portrait',
    pageMargins: [36, 96, 36, 72],
    info: { title: `${festival} — ${opts.title}`, creator: festival },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1c1917' },
    styles: {
      h1: { fontSize: 16, bold: true, color: BRAND, margin: [0, 0, 0, 4] },
      h2: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] },
      muted: { color: '#57534e' },
      th: { bold: true, fillColor: '#fbe4e4' },
    },
    header: () => ({
      margin: [36, 24, 36, 0],
      columns: [
        {
          width: '*',
          stack: [
            { text: festival, bold: true, fontSize: 13, color: BRAND },
            { text: `${range} · ${generated}`, style: 'muted', fontSize: 8 },
          ],
        },
        {
          width: 'auto',
          columns: organiserLogos.map(
            (l) =>
              ({ ...(imageNode(l.image, [70, 36]) as object), width: 76 }) as unknown as Content,
          ),
          columnGap: 6,
        } as unknown as Content,
      ],
    }),
    footer: (page: number, pages: number): Content => ({
      margin: [36, 8, 36, 0],
      stack: [
        sponsorLogos.length
          ? ({
              columns: sponsorLogos
                .slice(0, 8)
                .map(
                  (l) =>
                    ({
                      ...(imageNode(l.image, [56, 24]) as object),
                      width: 60,
                    }) as unknown as Content,
                ),
              columnGap: 6,
            } as unknown as Content)
          : { text: '' },
        {
          text: `Page ${page} of ${pages}`,
          alignment: 'right',
          style: 'muted',
          fontSize: 8,
          margin: [0, 4, 0, 0],
        },
      ],
    }),
    content: [{ text: opts.title, style: 'h1' }, ...opts.body],
  };
  return pdfmake().createPdf(doc).getBuffer();
}

export function pdfTable(
  headers: string[],
  rows: Array<Array<string | number>>,
  widths?: Array<string | number>,
): Content {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => '*'),
      body: [
        headers.map((h) => ({ text: h, style: 'th' })),
        ...rows.map((r) => r.map((c) => String(c ?? ''))),
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

export { pdfmake as getPdfMake };
