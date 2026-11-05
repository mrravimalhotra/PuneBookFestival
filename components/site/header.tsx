import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getPartners, getPublicSettings, partnersFor } from '@/lib/data/public';
import { PartnerLogo } from '@/components/brand/partner-logo';

export async function SiteHeader() {
  const [settings, partners] = await Promise.all([getPublicSettings(), getPartners()]);
  const organisers = partnersFor(partners, 'header', 'organiser').slice(0, 3);
  const name = settings ? `${settings.festival_name} ${settings.festival_year}` : '';

  return (
    <div className="container-page flex h-16 items-center gap-3">
      <Link
        href="/"
        className="flex min-w-0 items-center gap-3"
        aria-label={`${name} — ${t('common.home')}`}
      >
        {organisers.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5">
            {organisers.map((o, i) => (
              <PartnerLogo key={o.id} partner={o} size="xs" linked={false} priority={i === 0} />
            ))}
          </span>
        ) : null}
        <span className="text-brand-800 truncate text-base leading-tight font-bold sm:text-lg">
          {name}
        </span>
      </Link>
      <nav
        aria-label={t('header.nav')}
        className="ml-auto flex shrink-0 items-center gap-1 text-sm font-semibold"
      >
        <Link
          href="/my-pass"
          className="hover:bg-brand-50 hidden min-h-11 items-center rounded-md px-3 sm:inline-flex"
        >
          {t('common.myPass')}
        </Link>
        <Link
          href="/winners"
          className="hover:bg-brand-50 hidden min-h-11 items-center rounded-md px-3 sm:inline-flex"
        >
          {t('common.winners')}
        </Link>
        {settings?.registration_open !== false ? (
          <Link
            href="/register"
            className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-4 text-white"
          >
            {t('common.register')}
          </Link>
        ) : (
          <Link
            href="/my-pass"
            className="bg-brand-600 inline-flex min-h-11 items-center rounded-lg px-4 text-white sm:hidden"
          >
            {t('common.myPass')}
          </Link>
        )}
      </nav>
    </div>
  );
}

export function SiteHeaderFallback() {
  return <div className="container-page h-16" aria-hidden="true" />;
}
