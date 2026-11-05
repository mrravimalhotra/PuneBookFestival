'use client';

import { useEffect, useState } from 'react';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, Skeleton } from '@/components/ui/card';
import { PassView } from '@/components/pass/pass-view';
import { t } from '@/lib/i18n';
import { loadSavedPass, removeSavedPass } from '@/lib/pass-store';
import type { PassSnapshot } from '@/lib/pass-types';

/** Renders the pass from IndexedDB — works with no network (precached by the SW). */
export function SavedPassClient() {
  const [pass, setPass] = useState<PassSnapshot | null | undefined>(undefined);

  useEffect(() => {
    loadSavedPass().then(setPass);
  }, []);

  if (pass === undefined)
    return <Skeleton className="rounded-card mx-auto h-[640px] w-full max-w-sm" />;
  if (pass === null) {
    return (
      <div className="space-y-4 text-center">
        <Alert tone="info">{t('savedPass.none')}</Alert>
        <LinkButton href="/my-pass">{t('home.findPass')}</LinkButton>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-muted text-center text-sm">{t('savedPass.offlineNote')}</p>
      <PassView pass={pass} saveOffline={false} />
      <div className="no-print flex flex-wrap justify-center gap-3">
        <LinkButton href={`/pass/${pass.token}`} variant="ghost">
          {t('savedPass.openOnline')}
        </LinkButton>
        <Button
          variant="ghost"
          onClick={async () => {
            await removeSavedPass();
            setPass(null);
          }}
        >
          {t('savedPass.remove')}
        </Button>
      </div>
    </div>
  );
}
