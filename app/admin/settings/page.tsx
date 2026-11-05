import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Skeleton } from '@/components/ui/card';
import { SettingsForm } from '@/components/admin/settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Festival settings</h1>
      <p className="text-muted">
        Everything here can change each year without code changes. Saving regenerates the festival
        days.
      </p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Loaded />
      </Suspense>
    </div>
  );
}

async function Loaded() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select(
      'festival_name, festival_year, venue, start_date, end_date, daily_open_time, daily_close_time, registration_open, self_checkin_enabled, draw_winners_per_day, staff_limit, consent_text_version, privacy_text, contact_email',
    )
    .eq('id', 1)
    .single();
  if (!data) return <p>Settings row missing — run the migrations.</p>;
  return <SettingsForm s={data} />;
}
