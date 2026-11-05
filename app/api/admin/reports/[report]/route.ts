import { PassThrough, Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { AuthError, assertAdmin } from '@/lib/auth';
import { log } from '@/lib/logger';
import { loadBranding } from '@/lib/reports/branding';
import {
  REPORTS,
  pdfBody,
  sectionsFor,
  writeWorkbook,
  type ReportKey,
} from '@/lib/reports/definitions';
import { renderReportPdf } from '@/lib/reports/pdf';
import { createClient } from '@/lib/supabase/server';
import { attendeeFilterSchema } from '@/lib/validation/admin';

// Long exports must not time out on 1 lakh+ rows.
export const maxDuration = 300;

const querySchema = z.object({
  format: z.enum(['xlsx', 'pdf']),
  from: z.union([z.literal(''), z.iso.date()]).default(''),
  to: z.union([z.literal(''), z.iso.date()]).default(''),
});

export async function GET(request: Request, ctx: RouteContext<'/api/admin/reports/[report]'>) {
  try {
    await assertAdmin();
  } catch (err) {
    return new Response('Forbidden', { status: err instanceof AuthError ? err.status : 401 });
  }

  const { report } = await ctx.params;
  if (!(report in REPORTS)) return new Response('Unknown report', { status: 404 });
  const key = report as ReportKey;

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const q = querySchema.safeParse(sp);
  const filter = attendeeFilterSchema.safeParse(sp);
  if (!q.success || !filter.success) return new Response('Invalid parameters', { status: 400 });

  const supabase = await createClient();
  const sections = sectionsFor(key, supabase, {
    filter: filter.data,
    from: q.data.from,
    to: q.data.to,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${key}-${stamp}.${q.data.format}`;

  await supabase.rpc('log_audit', {
    p_action: 'report.export',
    p_entity: 'reports',
    p_entity_id: key,
    p_details: { format: q.data.format, filter: filter.data, from: q.data.from, to: q.data.to },
  });

  const headers = {
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  if (q.data.format === 'pdf') {
    try {
      const [branding, body] = await Promise.all([loadBranding('reports'), pdfBody(sections)]);
      const pdf = await renderReportPdf({
        title: REPORTS[key].title,
        branding,
        body,
        landscape: key === 'attendees' || key === 'winners' || key === 'checkins',
      });
      return new Response(new Uint8Array(pdf), {
        headers: { ...headers, 'Content-Type': 'application/pdf' },
      });
    } catch (err) {
      log.error('reports.pdf', err, { report: key });
      return new Response('Report failed', { status: 500 });
    }
  }

  // Excel: stream rows in pages of 5,000 straight into the response.
  const pass = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: pass,
    useStyles: true,
    useSharedStrings: false,
  });
  workbook.creator = 'Festival admin';
  writeWorkbook(workbook, sections).catch((err: unknown) => {
    log.error('reports.xlsx', err, { report: key });
    pass.destroy(err instanceof Error ? err : new Error('export failed'));
  });

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      ...headers,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}
