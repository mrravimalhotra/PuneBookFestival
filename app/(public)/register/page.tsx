import type { Metadata } from 'next';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import { getFestivalDays, getPublicSettings } from '@/lib/data/public';
import { Alert, Card, PageTitle, Skeleton } from '@/components/ui/card';
import { RegisterForm } from '@/components/forms/register-form';

export const metadata: Metadata = { title: t('meta.registerTitle') };

/** Static shell; festival dates come from a cached server fetch. */
export default function RegisterPage() {
  return (
    <div className="container-page max-w-2xl py-8 sm:py-12">
      <Suspense fallback={<FormSkeleton />}>
        <RegisterContent />
      </Suspense>
    </div>
  );
}

async function RegisterContent() {
  const [settings, days] = await Promise.all([getPublicSettings(), getFestivalDays()]);
  if (!settings) return <Alert tone="danger">{t('errors.genericText')}</Alert>;

  return (
    <>
      <PageTitle>
        {t('register.title', { festival: settings.festival_name, year: settings.festival_year })}
      </PageTitle>
      {settings.registration_open ? (
        <>
          <p className="text-muted mt-2 text-lg">{t('register.intro')}</p>
          <Card className="mt-6">
            <RegisterForm days={days} />
          </Card>
        </>
      ) : (
        <Alert tone="warning" className="mt-6">
          {t('register.closed')}
        </Alert>
      )}
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-[640px] w-full" />
    </div>
  );
}
