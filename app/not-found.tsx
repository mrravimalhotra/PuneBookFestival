import { t } from '@/lib/i18n';
import { LinkButton } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container-page max-w-lg py-16 text-center">
      <h1 className="text-3xl font-bold">{t('errors.notFound')}</h1>
      <p className="text-muted mt-2">{t('errors.notFoundText')}</p>
      <LinkButton href="/" className="mt-6">
        {t('common.home')}
      </LinkButton>
    </div>
  );
}
