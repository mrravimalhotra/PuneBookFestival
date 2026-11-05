import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getPartners, getPublicSettings, partnersFor } from '@/lib/data/public';
import { LogoStrip } from '@/components/brand/partner-groups';

export async function SiteFooter() {
  const [settings, partners] = await Promise.all([getPublicSettings(), getPartners()]);
  const organisers = partnersFor(partners, 'footer', 'organiser');
  const sponsors = partnersFor(partners, 'footer', 'sponsor').slice(0, 12);

  return (
    <div className="container-page space-y-8 py-10">
      <LogoStrip partners={organisers} label={t('footer.organisedBy')} size="md" />
      <LogoStrip partners={sponsors} label={t('footer.supportedBy')} size="xs" />
      <nav
        aria-label="Footer"
        className="text-brand-700 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold"
      >
        <Link href="/register" className="py-2 hover:underline">
          {t('common.register')}
        </Link>
        <Link href="/my-pass" className="py-2 hover:underline">
          {t('common.myPass')}
        </Link>
        <Link href="/winners" className="py-2 hover:underline">
          {t('common.winners')}
        </Link>
        <Link href="/organisers" className="py-2 hover:underline">
          {t('common.organisers')}
        </Link>
        <Link href="/privacy" className="py-2 hover:underline">
          {t('common.privacy')}
        </Link>
        <Link href="/staff/login" className="py-2 hover:underline">
          {t('common.staffLogin')}
        </Link>
      </nav>
      {settings ? (
        <p className="text-muted text-center text-xs">
          {t('footer.rights', { year: settings.festival_year, festival: settings.festival_name })}
        </p>
      ) : null}
    </div>
  );
}
