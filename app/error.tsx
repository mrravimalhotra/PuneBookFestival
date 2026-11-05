'use client';

import { useEffect } from 'react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('ui.error', error.digest ?? error.name);
  }, [error]);
  return (
    <div className="container-page max-w-lg py-16 text-center" role="alert">
      <h1 className="text-3xl font-bold">{t('errors.generic')}</h1>
      <p className="text-muted mt-2">{t('errors.genericText')}</p>
      <Button className="mt-6" onClick={reset}>
        {t('common.tryAgain')}
      </Button>
    </div>
  );
}
