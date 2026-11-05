import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AGE_BANDS, displayMobile, formatDateTime, formatDay } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { attendeeFilterSchema } from '@/lib/validation/admin';
import { Alert, Skeleton } from '@/components/ui/card';
import { Button, LinkButton } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Attendees' };
const PAGE_SIZE = 50;

export default function AttendeesPage(props: PageProps<'/admin/attendees'>) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Attendees</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AttendeesContent {...props} />
      </Suspense>
    </div>
  );
}

async function AttendeesContent({ searchParams }: PageProps<'/admin/attendees'>) {
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filter = attendeeFilterSchema.parse({ ...flat });
  const after = typeof flat.after === 'string' ? flat.after.split('|') : null;

  const supabase = await createClient();
  const common = {
    p_query: filter.q || undefined,
    p_date: filter.date || undefined,
    p_gender: filter.gender || undefined,
    p_age_band: filter.age_band || undefined,
    p_city: filter.city || undefined,
  };
  const [rows, count, days] = await Promise.all([
    supabase.rpc('admin_attendee_search', {
      ...common,
      p_after_created: after?.[0],
      p_after_id: after?.[1],
      p_limit: PAGE_SIZE + 1,
    }),
    supabase.rpc('admin_attendee_count', common),
    supabase.from('festival_days').select('festival_date').order('festival_date'),
  ]);
  const list = (rows.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (rows.data?.length ?? 0) > PAGE_SIZE;
  const last = list[list.length - 1];
  const qs = new URLSearchParams(
    Object.entries(filter).filter(([, v]) => v) as Array<[string, string]>,
  );
  const nextQs = new URLSearchParams(qs);
  if (last) nextQs.set('after', `${last.created_at}|${last.id}`);

  return (
    <>
      {flat.deleted ? <Alert tone="success">Attendee deleted.</Alert> : null}
      <form
        className="rounded-card border-line grid gap-2 border bg-white p-4 sm:grid-cols-3 lg:grid-cols-6"
        role="search"
      >
        <label className="sm:col-span-2">
          <span className="sr-only">Search name, mobile, email or pass code</span>
          <Input name="q" defaultValue={filter.q} placeholder="Name, mobile, email or pass code" />
        </label>
        <label>
          <span className="sr-only">Festival day</span>
          <Select name="date" defaultValue={filter.date}>
            <option value="">All days</option>
            {(days.data ?? []).map((d) => (
              <option key={d.festival_date} value={d.festival_date}>
                {formatDay(d.festival_date)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Gender</span>
          <Select name="gender" defaultValue={filter.gender}>
            <option value="">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Age band</span>
          <Select name="age_band" defaultValue={filter.age_band}>
            <option value="">All ages</option>
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">City</span>
          <Input name="city" defaultValue={filter.city} placeholder="City" />
        </label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <Button type="submit">Search</Button>
          <LinkButton href="/admin/attendees" variant="ghost">
            Clear
          </LinkButton>
        </div>
      </form>

      <p className="text-muted text-sm">
        {(count.data ?? 0).toLocaleString('en-IN')} matching attendees
      </p>

      <div className="rounded-card border-line overflow-x-auto border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-stone-50">
            <tr>
              {[
                'Name',
                'Pass code',
                'Mobile',
                'Gender / age',
                'City',
                'Days',
                'Check-ins',
                'Registered',
              ].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-line border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/attendees/${a.id}`}
                    className="text-brand-700 font-semibold underline-offset-4 hover:underline"
                  >
                    {a.full_name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{a.pass_code}</td>
                <td className="px-3 py-2 tabular-nums">{displayMobile(a.mobile)}</td>
                <td className="px-3 py-2">
                  {a.gender.replaceAll('_', ' ')} / {a.age}
                </td>
                <td className="px-3 py-2">{a.location_city}</td>
                <td className="px-3 py-2">{(a.dates ?? []).length}</td>
                <td className="px-3 py-2">{a.checkin_days}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-muted px-3 py-6 text-center">
                  No attendees match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {after ? (
          <LinkButton href={`/admin/attendees?${qs}`} variant="outline" size="sm">
            First page
          </LinkButton>
        ) : null}
        {hasMore ? (
          <LinkButton href={`/admin/attendees?${nextQs}`} variant="outline" size="sm">
            Next page
          </LinkButton>
        ) : null}
      </div>
    </>
  );
}
