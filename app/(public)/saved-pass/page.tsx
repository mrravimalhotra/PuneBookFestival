import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { SavedPassClient } from './saved-pass-client';

export const metadata: Metadata = { title: t('meta.savedPassTitle'), robots: { index: false } };

/** Fully static shell; the pass itself comes from the device (IndexedDB). */
export default function SavedPassPage() {
  return (
    <div className="container-page max-w-xl py-6 sm:py-10">
      <h1 className="sr-only">{t('savedPass.title')}</h1>
      <SavedPassClient />
    </div>
  );
}
