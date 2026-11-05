import type { Metadata } from 'next';
import { Suspense } from 'react';
import { formatDay } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { Card, Skeleton } from '@/components/ui/card';
import { BarList } from '@/components/admin/bar-list';
import { FootfallChart, RegistrationsChart } from '@/components/admin/charts-lazy';

export const metadata: Metadata = { title: 'Dashboard' };

const GENDER: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

/** KPI cards stream first; charts and breakdowns follow. */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        <Kpis />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Charts />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Breakdowns />
      </Suspense>
    </div>
  );
}

async function Kpis() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('admin_kpis');
  const k = data?.[0];
  const tiles = [
    ['Total registrations', k?.total_registrations ?? 0],
    ["Today's check-ins", k?.today_checkins ?? 0],
    ['Total check-ins', k?.total_checkins ?? 0],
    ['Registered → attended', `${k?.conversion_rate ?? 0}%`],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([label, value]) => (
        <Card key={label} className="p-4 sm:p-5">
          <dt className="text-muted text-sm">{label}</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums">
            {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
          </dd>
        </Card>
      ))}
    </dl>
  );
}

async function Charts() {
  const supabase = await createClient();
  const [reg, daily] = await Promise.all([
    supabase.rpc('admin_registrations_per_day'),
    supabase.rpc('admin_daily_stats'),
  ]);
  const regData = (reg.data ?? []).map((r) => ({
    label: formatDay(r.signup_date),
    registrations: r.registrations,
  }));
  const dailyData = (daily.data ?? [])
    .filter((d) => d.is_active || d.expected > 0)
    .map((d) => ({
      label: formatDay(d.festival_date),
      expected: d.expected,
      actual: d.actual,
    }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RegistrationsChart data={regData} />
      <FootfallChart data={dailyData} />
    </div>
  );
}

async function Breakdowns() {
  const supabase = await createClient();
  const [gender, age, city, area, staff] = await Promise.all([
    supabase.rpc('admin_breakdown', { p_dimension: 'gender' }),
    supabase.rpc('admin_breakdown', { p_dimension: 'age_band' }),
    supabase.rpc('admin_breakdown', { p_dimension: 'city' }),
    supabase.rpc('admin_breakdown', { p_dimension: 'area' }),
    supabase.rpc('admin_checkins_by_staff'),
  ]);
  const toRows = (d: typeof gender.data, map?: Record<string, string>) =>
    (d ?? []).map((r) => ({
      label: map?.[r.label] ?? r.label,
      value: r.attendees,
      secondary: r.checked_in,
    }));
  const staffRows = staff.data ?? [];
  const byMethod = ['staff', 'self'].map((m) => ({
    label: m === 'staff' ? 'Staff scan' : 'Self check-in',
    value: staffRows.filter((r) => r.method === m).reduce((a, r) => a + r.total, 0),
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title="By gender" rows={toRows(gender.data, GENDER)} />
      <BarList title="By age band" rows={toRows(age.data)} />
      <BarList title="Top cities" rows={toRows(city.data).slice(0, 10)} />
      <BarList title="Top areas" rows={toRows(area.data).slice(0, 10)} />
      <BarList title="Check-ins by method" rows={byMethod} valueLabel="Check-ins" />
      <Card className="p-4">
        <h2 className="mb-3 font-bold">Check-ins by staff member</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-line border-b py-1">
                Who
              </th>
              <th scope="col" className="border-line border-b py-1 text-right">
                Today
              </th>
              <th scope="col" className="border-line border-b py-1 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {staffRows.map((r) => (
              <tr key={`${r.staff_id}-${r.method}`}>
                <td className="border-line border-b py-1">{r.staff_name}</td>
                <td className="border-line border-b py-1 text-right tabular-nums">{r.today}</td>
                <td className="border-line border-b py-1 text-right tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
