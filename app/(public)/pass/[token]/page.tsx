import type { Metadata } from 'next';
import { CheckCircle2, Circle } from 'lucide-react';
import { connection } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';
import { formatClock } from '@/lib/format';
import { t } from '@/lib/i18n';
import { log } from '@/lib/logger';
import { buildSnapshot, loadPass } from '@/lib/pass-data';
import { verifyPassToken } from '@/lib/tokens';
import { getKeyPeople, getPartners, getPublicSettings, peopleFor } from '@/lib/data/public';
import { Alert, Card, Skeleton } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { WelcomeFromStrip } from '@/components/brand/people';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PassView } from '@/components/pass/pass-view';

export const metadata: Metadata = {
  title: t('meta.passTitle'),
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function PassPage(props: PageProps<'/pass/[token]'>) {
  return (
    <div className="container-page max-w-xl py-6 sm:py-10">
      <Suspense fallback={<PassSkeleton />}>
        <PassContent {...props} />
      </Suspense>
    </div>
  );
}

async function PassContent({ params, searchParams }: PageProps<'/pass/[token]'>) {
  // Personal data: always rendered per request, never prerendered.
  await connection();
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const attendeeId = verifyPassToken(token);
  if (!attendeeId) return <InvalidPass />;

  let pass;
  try {
    pass = await loadPass(attendeeId);
  } catch (err) {
    unstable_rethrow(err);
    log.error('pass.load', err);
    return <Alert tone="danger">{t('errors.genericText')}</Alert>;
  }
  if (!pass) return <InvalidPass notFound />;

  const [settings, partners, people] = await Promise.all([
    getPublicSettings(),
    getPartners(),
    getKeyPeople(),
  ]);
  if (!settings) return <Alert tone="danger">{t('errors.genericText')}</Alert>;

  const snapshot = await buildSnapshot(pass, settings, partners);
  const welcome = sp.welcome === '1';
  const existing = sp.existing === '1';
  const added = sp.added === '1';

  const status = pass.checkedInToday ? (
    <p className="bg-success-50 text-success-700 flex items-center justify-center gap-2 rounded-lg py-2 font-bold">
      <CheckCircle2 aria-hidden="true" className="size-5" />
      {t('pass.checkedInToday', { time: formatClock(pass.checkedInAt!) })}
    </p>
  ) : (
    <p className="text-muted flex items-center justify-center gap-2 rounded-lg bg-stone-100 py-2 font-semibold">
      <Circle aria-hidden="true" className="size-5" />
      {t('pass.notCheckedInToday')}
    </p>
  );

  return (
    <div className="space-y-6">
      {welcome ? (
        <Card className="border-success-600/40 bg-success-50 text-center">
          <h1 className="text-success-700 text-2xl font-bold">{t('pass.confirmTitle')}</h1>
          <p className="mt-1">{t('pass.confirmText')}</p>
        </Card>
      ) : existing ? (
        <Alert tone="info" className="text-center">
          <h1 className="font-bold">{t('pass.existing')}</h1>
          {added ? <p className="mt-1">{t('pass.datesAdded')}</p> : null}
        </Alert>
      ) : (
        <h1 className="sr-only">{t('meta.passTitle')}</h1>
      )}

      <PassView pass={snapshot} status={status} />

      {welcome ? <WelcomeFromStrip people={peopleFor(people, 'pass')} /> : null}

      <InstallPrompt
        text={t('common.installPrompt')}
        iosText={t('common.installIos')}
        installLabel={t('common.install')}
        notNowLabel={t('common.notNow')}
      />

      <p className="text-muted text-center text-sm">{t('pass.selfCheckinHint')}</p>
    </div>
  );
}

function InvalidPass({ notFound = false }: { notFound?: boolean }) {
  return (
    <Card className="text-center">
      <h1 className="text-2xl font-bold">{notFound ? t('pass.notFound') : t('pass.invalid')}</h1>
      <p className="text-muted mt-2">{t('pass.invalidHint')}</p>
      <LinkButton href="/my-pass" className="mt-4">
        {t('home.findPass')}
      </LinkButton>
    </Card>
  );
}

function PassSkeleton() {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <Skeleton className="rounded-card h-[640px] w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
