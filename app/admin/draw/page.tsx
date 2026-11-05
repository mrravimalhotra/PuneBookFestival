import type { Metadata } from 'next';
import { Suspense } from 'react';
import { displayMobile, festivalTodayIso, formatLongDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { Card, Skeleton } from '@/components/ui/card';
import { PublishForm, RunDrawForm } from '@/components/admin/draw-forms';

export const metadata: Metadata = { title: 'Lucky draw' };

export default function DrawPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lucky draw</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <DrawContent />
      </Suspense>
    </div>
  );
}

async function DrawContent() {
  const supabase = await createClient();
  const [{ data: days }, { data: winners }, { data: settings }] = await Promise.all([
    supabase.from('festival_days').select('festival_date').order('festival_date'),
    supabase.rpc('admin_winners'),
    supabase.from('settings').select('draw_winners_per_day').eq('id', 1).single(),
  ]);
  const drawnDates = new Set((winners ?? []).map((w) => w.draw_date));
  const eligible = await Promise.all(
    (days ?? []).map(async (d) => {
      const done = drawnDates.has(d.festival_date);
      if (done) return { date: d.festival_date, eligible: 0, done };
      const { data } = await supabase.rpc('draw_eligible_count', { p_draw_date: d.festival_date });
      return { date: d.festival_date, eligible: data ?? 0, done };
    }),
  );
  const today = festivalTodayIso();
  const defaultDate =
    eligible.find((d) => d.date === today && !d.done)?.date ??
    eligible.find((d) => !d.done)?.date ??
    '';

  const draws = new Map<number, NonNullable<typeof winners>>();
  for (const w of winners ?? []) draws.set(w.draw_id, [...(draws.get(w.draw_id) ?? []), w]);

  return (
    <>
      <Card className="max-w-xl">
        <h2 className="mb-1 text-lg font-bold">Run a draw</h2>
        <p className="text-muted mb-4 text-sm">
          Picks {settings?.draw_winners_per_day ?? 5} winners at random from people who checked in
          on that date and have not won before.
        </p>
        {eligible.length ? (
          <RunDrawForm days={eligible} defaultDate={defaultDate} />
        ) : (
          <p>No festival days configured.</p>
        )}
      </Card>

      {[...draws.entries()].map(([id, rows]) => (
        <Card key={id}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{formatLongDate(rows[0].draw_date)}</h2>
            <span className="text-muted text-sm">
              Drawn by {rows[0].drawn_by_name ?? '—'} ·{' '}
              {rows[0].published ? 'Published' : 'Not published'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr>
                  {['#', 'Name', 'Mobile', 'Email', 'Pass code'].map((h) => (
                    <th key={h} scope="col" className="border-line border-b py-1 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.position}>
                    <td className="border-line border-b py-1 pr-3">{w.position}</td>
                    <td className="border-line border-b py-1 pr-3 font-semibold">{w.full_name}</td>
                    <td className="border-line border-b py-1 pr-3 tabular-nums">
                      {displayMobile(w.mobile)}
                    </td>
                    <td className="border-line border-b py-1 pr-3">{w.email}</td>
                    <td className="border-line border-b py-1 pr-3 font-mono">{w.pass_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <PublishForm id={id} published={rows[0].published} prize={rows[0].prize_note} />
          </div>
        </Card>
      ))}
    </>
  );
}
