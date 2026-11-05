import type { Metadata } from 'next';
import { Suspense } from 'react';
import { formatDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getPublicSettings } from '@/lib/data/public';
import { Card, PageTitle, Skeleton } from '@/components/ui/card';

export const metadata: Metadata = { title: t('meta.privacyTitle') };

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <PageTitle>{t('privacy.title')}</PageTitle>
      <Suspense fallback={<Skeleton className="mt-6 h-72 w-full" />}>
        <PrivacyText />
      </Suspense>
    </div>
  );
}

/** Admin-managed text, rendered as plain paragraphs (no HTML injection). */
async function PrivacyText() {
  const s = await getPublicSettings();
  const paragraphs = (s?.privacy_text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <Card className="prose-text mt-6 text-lg leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
      {s?.contact_email ? (
        <p>
          <strong>{t('privacy.contact')}:</strong>{' '}
          <a
            href={`mailto:${s.contact_email}`}
            className="text-brand-700 underline underline-offset-4"
          >
            {s.contact_email}
          </a>
        </p>
      ) : null}
      {s?.updated_at ? (
        <p className="text-muted text-sm">
          {t('privacy.lastUpdated', { date: formatDateTime(s.updated_at) })}
        </p>
      ) : null}
    </Card>
  );
}
