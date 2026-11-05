import type { Metadata } from 'next';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import { Card, PageTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/staff/login-form';

export const metadata: Metadata = { title: t('staff.loginTitle'), robots: { index: false } };

export default function StaffLoginPage(props: PageProps<'/staff/login'>) {
  return (
    <div className="container-page max-w-md py-10">
      <PageTitle>{t('staff.loginTitle')}</PageTitle>
      <Card className="mt-6">
        <Suspense fallback={<LoginForm />}>
          <LoginWithNext {...props} />
        </Suspense>
      </Card>
    </div>
  );
}

async function LoginWithNext({ searchParams }: PageProps<'/staff/login'>) {
  const sp = await searchParams;
  return <LoginForm next={typeof sp.next === 'string' ? sp.next : undefined} />;
}
