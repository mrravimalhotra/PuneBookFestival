import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import { getPublicSettings } from '@/lib/data/public';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader, SiteHeaderFallback } from '@/components/site/header';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import { WebVitals } from '@/components/site/web-vitals';
import './globals.css';

// Mukta covers Latin and Devanagari, ready for a Marathi translation.
const mukta = Mukta({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-mukta',
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSettings();
  const name = s ? `${s.festival_name} ${s.festival_year}` : 'Book Festival';
  const description = s
    ? t('meta.description', { festival: s.festival_name, year: s.festival_year, venue: s.venue })
    : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return {
    metadataBase: appUrl ? new URL(appUrl) : undefined,
    title: { default: name, template: `%s · ${name}` },
    description,
    applicationName: name,
    appleWebApp: { capable: true, title: s?.festival_name ?? name, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    openGraph: { type: 'website', title: name, description, siteName: name, locale: 'en_IN' },
    twitter: { card: 'summary_large_image', title: name, description },
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#891a27',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={mukta.variable}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">
          {t('common.skipToContent')}
        </a>
        <OfflineBanner label={t('common.offlineBanner')} />
        <header className="no-print border-line sticky top-0 z-40 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <Suspense fallback={<SiteHeaderFallback />}>
            <SiteHeader />
          </Suspense>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="no-print border-line border-t bg-white pb-[env(safe-area-inset-bottom)]">
          <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
            <SiteFooter />
          </Suspense>
        </footer>
        <ServiceWorkerRegister message={t('common.newVersion')} action={t('common.tapToRefresh')} />
        <WebVitals />
      </body>
    </html>
  );
}
