import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireStaffPage } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { Skeleton } from '@/components/ui/card';
import { Scanner } from '@/components/staff/scanner';
import { StaffBar } from '@/components/staff/staff-bar';

export const metadata: Metadata = { title: t('staff.scanTitle'), robots: { index: false } };

/** Loads once and keeps the camera running between scans (no page reloads). */
export default function ScanPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-6 aspect-square w-full max-w-md" />}>
      <ScanContent />
    </Suspense>
  );
}

async function ScanContent() {
  const user = await requireStaffPage('/staff/scan');
  const supabase = await createClient();
  const { data: count } = await supabase.rpc('staff_today_count');
  return (
    <>
      <StaffBar user={user} />
      <div className="container-page max-w-md py-4">
        <h1 className="sr-only">{t('staff.scanTitle')}</h1>
        <Scanner initialTodayCount={count ?? 0} />
      </div>
    </>
  );
}
