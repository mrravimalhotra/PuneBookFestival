import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { displayMobile, formatDateTime, formatDay } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { Card, Skeleton } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { DeleteAttendee } from '@/components/admin/delete-attendee';

export const metadata: Metadata = { title: 'Attendee' };

export default function AttendeePage(props: PageProps<'/admin/attendees/[id]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AttendeeDetail {...props} />
    </Suspense>
  );
}

async function AttendeeDetail({ params }: PageProps<'/admin/attendees/[id]'>) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: a }, { data: dates }, { data: checkins }] = await Promise.all([
    supabase
      .from('attendees')
      .select(
        'id, pass_code, full_name, mobile, email, gender, age, location_city, location_area, consent_text_version, consent_at, created_at',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('attendee_dates')
      .select('festival_date')
      .eq('attendee_id', id)
      .order('festival_date'),
    supabase
      .from('checkins')
      .select('id, checkin_date, checkin_at, method, profiles(full_name)')
      .eq('attendee_id', id)
      .order('checkin_at'),
  ]);
  if (!a) notFound();

  const rows: Array<[string, string]> = [
    ['Pass code', a.pass_code],
    ['Mobile', displayMobile(a.mobile)],
    ['Email', a.email],
    ['Gender', a.gender.replaceAll('_', ' ')],
    ['Age', String(a.age)],
    ['City / area', [a.location_city, a.location_area].filter(Boolean).join(', ')],
    ['Registered', formatDateTime(a.created_at)],
    ['Consent', `${a.consent_text_version} · ${formatDateTime(a.consent_at)}`],
    ['Days chosen', (dates ?? []).map((d) => formatDay(d.festival_date)).join(', ')],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <LinkButton href="/admin/attendees" variant="ghost" size="sm">
        ← All attendees
      </LinkButton>
      <h1 className="text-2xl font-bold">{a.full_name}</h1>
      <Card>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted font-semibold">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <h2 className="mb-2 font-bold">Check-ins</h2>
        {(checkins ?? []).length === 0 ? <p className="text-muted">None yet.</p> : null}
        <ul className="space-y-1">
          {(checkins ?? []).map((c) => (
            <li key={c.id}>
              {formatDay(c.checkin_date)} · {formatDateTime(c.checkin_at)} ·{' '}
              {c.method === 'self' ? 'Self' : `Staff (${c.profiles?.full_name ?? 'deleted'})`}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="border-danger-600/40">
        <h2 className="text-danger-700 mb-2 font-bold">Delete on request</h2>
        <DeleteAttendee id={a.id} />
      </Card>
    </div>
  );
}
