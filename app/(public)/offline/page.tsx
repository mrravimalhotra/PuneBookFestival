import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { t } from '@/lib/i18n';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: t('meta.offlineTitle'), robots: { index: false } };

/** Static offline fallback, precached by the service worker. */
export default function OfflinePage() {
  return (
    <div className="container-page max-w-lg py-12">
      <Card className="text-center">
        <WifiOff aria-hidden="true" className="text-muted mx-auto size-12" />
        <h1 className="mt-3 text-2xl font-bold">{t('offline.title')}</h1>
        <p className="text-muted mt-2">{t('offline.text')}</p>
        <LinkButton href="/saved-pass" className="mt-5" size="lg">
          {t('offline.openSaved')}
        </LinkButton>
      </Card>
    </div>
  );
}
