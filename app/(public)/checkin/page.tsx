import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import { verifyVenueKey } from '@/lib/tokens';
import {
  getKeyPeople,
  getPartners,
  getPublicSettings,
  peopleFor,
  topSponsors,
} from '@/lib/data/public';
import { Alert, Card, PageTitle, Skeleton } from '@/components/ui/card';
import { LogoStrip } from '@/components/brand/partner-groups';
import { WelcomeFromStrip } from '@/components/brand/people';
import { SelfCheckinForm } from '@/components/forms/self-checkin-form';
import { RememberVenueKey, RestoreVenueKey } from '@/components/pwa/venue-key-memory';

export const metadata: Metadata = { title: t('meta.checkinTitle'), robots: { index: false } };

export default function CheckinPage(props: PageProps<'/checkin'>) {
  return (
    <div className="container-page max-w-lg py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CheckinContent {...props} />
      </Suspense>
    </div>
  );
}

async function CheckinContent({ searchParams }: PageProps<'/checkin'>) {
  const [sp, settings, partners, people] = await Promise.all([
    searchParams,
    getPublicSettings(),
    getPartners(),
    getKeyPeople(),
  ]);
  const key = typeof sp.k === 'string' ? sp.k : '';
  if (!settings) return <Alert tone="danger">{t('errors.genericText')}</Alert>;

  if (!verifyVenueKey(key, settings.festival_year)) {
    return (
      <Card className="text-center">
        <PageTitle className="text-2xl">{t('checkin.title')}</PageTitle>
        <p className="mt-3 text-lg">{t('checkin.invalidKey')}</p>
        {key ? null : <RestoreVenueKey />}
      </Card>
    );
  }
  if (!settings.self_checkin_enabled) {
    return (
      <Card className="text-center">
        <PageTitle className="text-2xl">{t('checkin.title')}</PageTitle>
        <p className="mt-3 text-lg">{t('checkin.disabled')}</p>
      </Card>
    );
  }

  const sponsors = topSponsors(partners, 'checkin_success');
  const extras = (
    <div className="space-y-6">
      {sponsors.length > 0 ? (
        <div className="rounded-card border-line border bg-white p-4">
          <LogoStrip partners={sponsors} label={t('checkin.sponsorBanner')} size="lg" />
        </div>
      ) : null}
      <WelcomeFromStrip people={peopleFor(people, 'checkin_success')} />
    </div>
  );

  return (
    <>
      <PageTitle>{t('checkin.title')}</PageTitle>
      <p className="text-muted mt-2 text-lg">
        {t('checkin.intro', { festival: settings.festival_name })}
      </p>
      <RememberVenueKey venueKey={key} />
      <Card className="mt-6">
        <SelfCheckinForm venueKey={key} successExtras={extras} />
      </Card>
      <p className="mt-6 text-center">
        <Link
          href="/register"
          className="text-brand-700 font-semibold underline underline-offset-4"
        >
          {t('checkin.notRegistered')}
        </Link>
      </p>
    </>
  );
}
