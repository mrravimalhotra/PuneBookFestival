import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { logoutAction } from '@/app/staff/actions';
import { t } from '@/lib/i18n';
import type { CurrentUser } from '@/lib/auth';

export function StaffBar({ user }: { user: CurrentUser }) {
  return (
    <div className="border-line flex items-center justify-between gap-2 border-b bg-stone-50 px-4 py-2 text-sm">
      <span className="truncate font-semibold">{user.fullName}</span>
      <div className="flex items-center gap-1">
        {user.role === 'admin' ? (
          <Link
            href="/admin/dashboard"
            className="text-brand-700 hover:bg-brand-50 inline-flex min-h-11 items-center rounded-md px-3 font-semibold"
          >
            {t('staff.adminLink')}
          </Link>
        ) : null}
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold hover:bg-stone-200"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t('staff.signOut')}
          </button>
        </form>
      </div>
    </div>
  );
}
