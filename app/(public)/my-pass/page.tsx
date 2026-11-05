import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { Card, PageTitle } from '@/components/ui/card';
import { MyPassForm } from '@/components/forms/my-pass-form';

export const metadata: Metadata = { title: t('meta.myPassTitle'), robots: { index: false } };

export default function MyPassPage() {
  return (
    <div className="container-page max-w-lg py-8 sm:py-12">
      <PageTitle>{t('myPass.title')}</PageTitle>
      <p className="text-muted mt-2">{t('myPass.intro')}</p>
      <Card className="mt-6">
        <MyPassForm />
      </Card>
      <p className="mt-6 text-center">
        {t('myPass.noAccount')}{' '}
        <Link
          href="/register"
          className="text-brand-700 font-semibold underline underline-offset-4"
        >
          {t('common.registerNow')}
        </Link>
      </p>
    </div>
  );
}
