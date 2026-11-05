import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { Card, Skeleton } from '@/components/ui/card';
import { CreateStaffForm, StaffRowActions } from '@/components/admin/staff-forms';

export const metadata: Metadata = { title: 'Staff' };

export default function StaffAdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Staff accounts</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <StaffList />
      </Suspense>
    </div>
  );
}

async function StaffList() {
  const supabase = await createClient();
  const [me, { data: people }, { data: s }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('role')
      .order('full_name'),
    supabase.from('settings').select('staff_limit').eq('id', 1).single(),
  ]);
  const activeStaff = (people ?? []).filter((p) => p.role === 'staff' && p.is_active).length;
  return (
    <>
      <Card>
        <h2 className="mb-1 text-lg font-bold">Add a staff member</h2>
        <p className="text-muted mb-4 text-sm">
          {activeStaff} of {s?.staff_limit ?? 10} active staff accounts used. Staff can scan passes
          and search by pass code or mobile; they cannot see reports or bulk data.
        </p>
        <CreateStaffForm />
      </Card>
      <div className="rounded-card border-line overflow-x-auto border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-stone-50">
            <tr>
              {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} scope="col" className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr key={p.id} className="border-line border-t align-top">
                <td className="px-3 py-2 font-semibold">{p.full_name}</td>
                <td className="px-3 py-2">{p.email}</td>
                <td className="px-3 py-2 capitalize">{p.role}</td>
                <td className="px-3 py-2">{p.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                <td className="px-3 py-2">
                  <StaffRowActions id={p.id} active={p.is_active} self={p.id === me?.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
