import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireAdminPage } from '@/lib/auth';
import { Skeleton } from '@/components/ui/card';
import { AdminNav } from '@/components/admin/admin-nav';
import { StaffBar } from '@/components/staff/staff-bar';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false },
};

/** Every admin page renders only after the server confirms an active admin. */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  return (
    <>
      <StaffBar user={user} />
      <div className="container-page py-4">
        <AdminNav />
        <div className="py-6">{children}</div>
      </div>
    </>
  );
}
