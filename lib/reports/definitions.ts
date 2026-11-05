import 'server-only';
import type ExcelJS from 'exceljs';
import type { Content } from 'pdfmake/interfaces';
import { displayMobile, formatDateTime, formatLongDate } from '@/lib/format';
import type { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { AttendeeFilter } from '@/lib/validation/admin';

type Fns = Database['public']['Functions'];
type SearchRow = Fns['admin_attendee_search']['Returns'][number];
type LogRow = Fns['admin_checkin_log']['Returns'][number];
import { PDF_ROW_CAP, pdfTable } from './pdf';

type Client = Awaited<ReturnType<typeof createClient>>;
export type ReportKey = 'attendees' | 'daily' | 'checkins' | 'demographics' | 'winners';

export const REPORTS: Record<ReportKey, { title: string; description: string }> = {
  attendees: {
    title: 'Attendee list',
    description: 'Every registration, with the filters you choose.',
  },
  daily: {
    title: 'Daily summary',
    description: 'Registrations, expected footfall and actual check-ins per day.',
  },
  checkins: { title: 'Check-in log', description: 'Every check-in with method and staff member.' },
  demographics: {
    title: 'Demographics',
    description: 'Breakdown by gender, age band, city and area.',
  },
  winners: { title: 'Lucky draw winners', description: 'All draws with winners’ contact details.' },
};

export type ReportParams = { filter: AttendeeFilter; from: string; to: string };

const PAGE = 5000;

type Column = { header: string; key: string; width?: number };

/** One sheet section: columns + async row source (streamed page by page). */
export type Section = {
  sheet: string;
  columns: Column[];
  rows: () => AsyncGenerator<Array<Record<string, string | number | null>>>;
};

function rpcError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const GENDER: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export function sectionsFor(key: ReportKey, supabase: Client, p: ReportParams): Section[] {
  switch (key) {
    case 'attendees':
      return [
        {
          sheet: 'Attendees',
          columns: [
            { header: 'Pass code', key: 'pass_code', width: 13 },
            { header: 'Full name', key: 'full_name' },
            { header: 'Mobile', key: 'mobile', width: 14 },
            { header: 'Email', key: 'email' },
            { header: 'Gender', key: 'gender', width: 12 },
            { header: 'Age', key: 'age', width: 6 },
            { header: 'Age band', key: 'age_band', width: 12 },
            { header: 'City', key: 'city' },
            { header: 'Area', key: 'area' },
            { header: 'Days chosen', key: 'dates' },
            { header: 'Days checked in', key: 'checkin_days', width: 10 },
            { header: 'Registered (IST)', key: 'created_at', width: 22 },
            { header: 'Consent version', key: 'consent', width: 10 },
          ],
          async *rows() {
            let after: { created: string; id: string } | null = null;
            for (;;) {
              const res = await supabase.rpc('admin_attendee_search', {
                p_query: p.filter.q || undefined,
                p_date: p.filter.date || undefined,
                p_gender: p.filter.gender || undefined,
                p_age_band: p.filter.age_band || undefined,
                p_city: p.filter.city || undefined,
                p_after_created: after?.created,
                p_after_id: after?.id,
                p_limit: PAGE,
              });
              rpcError(res.error);
              const data = res.data as SearchRow[] | null;
              if (!data?.length) return;
              yield data.map((r) => ({
                pass_code: r.pass_code,
                full_name: r.full_name,
                mobile: displayMobile(r.mobile),
                email: r.email,
                gender: GENDER[r.gender] ?? r.gender,
                age: r.age,
                age_band: r.age_band,
                city: r.location_city,
                area: r.location_area,
                dates: (r.dates ?? []).join(', '),
                checkin_days: r.checkin_days,
                created_at: formatDateTime(r.created_at),
                consent: r.consent_text_version,
              }));
              if (data.length < PAGE) return;
              const last: SearchRow = data[data.length - 1];
              after = { created: last.created_at, id: last.id };
            }
          },
        },
      ];

    case 'daily':
      return [
        {
          sheet: 'Daily summary',
          columns: [
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Active', key: 'active', width: 8 },
            { header: 'Registrations that day', key: 'signups', width: 14 },
            { header: 'Expected footfall', key: 'expected', width: 14 },
            { header: 'Actual check-ins', key: 'actual', width: 14 },
            { header: 'Staff scans', key: 'staff', width: 12 },
            { header: 'Self check-ins', key: 'self', width: 12 },
            { header: 'Turn-out vs expected', key: 'rate', width: 14 },
          ],
          async *rows() {
            const { data, error } = await supabase.rpc('admin_daily_stats');
            rpcError(error);
            const rows = (data ?? []).map((r) => ({
              date: formatLongDate(r.festival_date),
              active: r.is_active ? 'Yes' : 'No',
              signups: r.signups,
              expected: r.expected,
              actual: r.actual,
              staff: r.staff_checkins,
              self: r.self_checkins,
              rate: r.expected ? `${Math.round((r.actual / r.expected) * 100)}%` : '—',
            }));
            const sum = (k: 'signups' | 'expected' | 'actual' | 'staff' | 'self') =>
              rows.reduce((a, r) => a + Number(r[k]), 0);
            const exp = sum('expected');
            const act = sum('actual');
            rows.push({
              date: 'Total',
              active: '',
              signups: sum('signups'),
              expected: exp,
              actual: act,
              staff: sum('staff'),
              self: sum('self'),
              rate: exp ? `${Math.round((act / exp) * 100)}%` : '—',
            });
            yield rows;
          },
        },
      ];

    case 'checkins':
      return [
        {
          sheet: 'Check-ins',
          columns: [
            { header: 'Checked in (IST)', key: 'at', width: 22 },
            { header: 'Festival day', key: 'date', width: 12 },
            { header: 'Method', key: 'method', width: 8 },
            { header: 'Staff member', key: 'staff' },
            { header: 'Pass code', key: 'pass_code', width: 13 },
            { header: 'Attendee', key: 'name' },
          ],
          async *rows() {
            let after: { at: string; id: number } | null = null;
            for (;;) {
              const res = await supabase.rpc('admin_checkin_log', {
                p_from: p.from || undefined,
                p_to: p.to || undefined,
                p_after_at: after?.at,
                p_after_id: after?.id,
                p_limit: PAGE,
              });
              rpcError(res.error);
              const data = res.data as LogRow[] | null;
              if (!data?.length) return;
              yield data.map((r) => ({
                at: formatDateTime(r.checkin_at),
                date: r.checkin_date,
                method: r.method === 'self' ? 'Self' : 'Staff',
                staff: r.staff_name ?? '',
                pass_code: r.pass_code,
                name: r.full_name,
              }));
              if (data.length < PAGE) return;
              const last: LogRow = data[data.length - 1];
              after = { at: last.checkin_at, id: last.id };
            }
          },
        },
      ];

    case 'demographics': {
      const dims: Array<[string, 'gender' | 'age_band' | 'city' | 'area']> = [
        ['Gender', 'gender'],
        ['Age band', 'age_band'],
        ['City', 'city'],
        ['Area', 'area'],
      ];
      return dims.map(([sheet, dim]) => ({
        sheet,
        columns: [
          { header: sheet, key: 'label' },
          { header: 'Registered', key: 'attendees', width: 12 },
          { header: 'Checked in at least once', key: 'checked_in', width: 14 },
          { header: 'Share of registrations', key: 'share', width: 14 },
        ],
        async *rows() {
          const { data, error } = await supabase.rpc('admin_breakdown', { p_dimension: dim });
          rpcError(error);
          const total = (data ?? []).reduce((a, r) => a + r.attendees, 0);
          yield (data ?? []).map((r) => ({
            label: dim === 'gender' ? (GENDER[r.label] ?? r.label) : r.label,
            attendees: r.attendees,
            checked_in: r.checked_in,
            share: total ? `${((r.attendees / total) * 100).toFixed(1)}%` : '—',
          }));
        },
      }));
    }

    case 'winners':
      return [
        {
          sheet: 'Winners',
          columns: [
            { header: 'Draw date', key: 'date', width: 18 },
            { header: '#', key: 'position', width: 4 },
            { header: 'Full name', key: 'name' },
            { header: 'Mobile', key: 'mobile', width: 14 },
            { header: 'Email', key: 'email' },
            { header: 'Pass code', key: 'pass_code', width: 13 },
            { header: 'Published', key: 'published', width: 10 },
            { header: 'Drawn by', key: 'by' },
            { header: 'Prize', key: 'prize' },
          ],
          async *rows() {
            const { data, error } = await supabase.rpc('admin_winners');
            rpcError(error);
            yield (data ?? []).map((r) => ({
              date: formatLongDate(r.draw_date),
              position: r.position,
              name: r.full_name,
              mobile: displayMobile(r.mobile),
              email: r.email,
              pass_code: r.pass_code,
              published: r.published ? 'Yes' : 'No',
              by: r.drawn_by_name ?? '',
              prize: r.prize_note ?? '',
            }));
          },
        },
      ];
  }
}

/** Streams every section into an ExcelJS streaming workbook (one sheet per section). */
export async function writeWorkbook(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  sections: Section[],
) {
  for (const s of sections) {
    const ws = workbook.addWorksheet(s.sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
    let first = true;
    for await (const batch of s.rows()) {
      if (first) {
        // Auto-width from the header and the first page of data.
        ws.columns = s.columns.map((c) => {
          const longest = Math.max(
            c.header.length,
            ...batch.slice(0, 500).map((r) => String(r[c.key] ?? '').length),
          );
          return {
            header: c.header,
            key: c.key,
            width: Math.min(60, Math.max(c.width ?? 8, longest + 2)),
          };
        });
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).commit();
        first = false;
      }
      for (const r of batch) ws.addRow(r).commit();
    }
    if (first) {
      ws.columns = s.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: Math.max(c.width ?? 12, c.header.length + 2),
      }));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).commit();
    }
    ws.commit();
  }
  await workbook.commit();
}

/** PDF body: summary PDFs with a row cap (the Excel file has the full detail). */
export async function pdfBody(sections: Section[]): Promise<Content[]> {
  const body: Content[] = [];
  for (const s of sections) {
    const rows: Array<Array<string | number>> = [];
    let total = 0;
    for await (const batch of s.rows()) {
      total += batch.length;
      for (const r of batch) {
        if (rows.length < PDF_ROW_CAP) rows.push(s.columns.map((c) => r[c.key] ?? ''));
      }
    }
    if (sections.length > 1) body.push({ text: s.sheet, style: 'h2' });
    body.push({
      text: `${total.toLocaleString('en-IN')} rows`,
      style: 'muted',
      margin: [0, 0, 0, 6],
    });
    body.push(
      pdfTable(
        s.columns.map((c) => c.header),
        rows,
      ),
    );
    if (total > PDF_ROW_CAP) {
      body.push({
        text: `Showing the first ${PDF_ROW_CAP.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} rows. Download Excel for the full list.`,
        style: 'muted',
        margin: [0, 6, 0, 0],
      });
    }
  }
  return body;
}
