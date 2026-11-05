'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/attendees', 'Attendees'],
  ['/admin/draw', 'Lucky draw'],
  ['/admin/reports', 'Reports'],
  ['/admin/settings', 'Settings'],
  ['/admin/staff', 'Staff'],
  ['/admin/partners', 'Sponsors & organisers'],
  ['/admin/people', 'Key people'],
  ['/admin/venue-qr', 'Venue QR'],
  ['/admin/audit', 'Audit log'],
  ['/staff/scan', 'Scanner'],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="no-print -mx-4 overflow-x-auto px-4">
      <ul className="border-line flex min-w-max gap-1 border-b">
        {LINKS.map(([href, label]) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold',
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'text-muted hover:text-ink border-transparent',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
