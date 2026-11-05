import type { Metadata } from 'next';
import { Trophy } from 'lucide-react';
import { Suspense } from 'react';
import { formatLongDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getPartners, getWinners, topSponsors } from '@/lib/data/public';
import { Card, PageTitle, Skeleton } from '@/components/ui/card';
import { LogoStrip } from '@/components/brand/partner-groups';

export const metadata: Metadata = { title: t('meta.winnersTitle') };

export default function WinnersPage() {
  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <PageTitle>{t('winners.title')}</PageTitle>
      <p className="text-muted mt-2">{t('winners.intro')}</p>
      <Suspense fallback={<Skeleton className="mt-6 h-72 w-full" />}>
        <WinnersList />
      </Suspense>
    </div>
  );
}

async function WinnersList() {
  const [winners, partners] = await Promise.all([getWinners(), getPartners()]);
  const prizeSponsors = topSponsors(partners, 'winners', 3);

  const byDate = new Map<string, typeof winners>();
  for (const w of winners) byDate.set(w.draw_date, [...(byDate.get(w.draw_date) ?? []), w]);

  return (
    <div className="mt-6 space-y-6">
      {prizeSponsors.length > 0 ? (
        <Card>
          <LogoStrip partners={prizeSponsors} label={t('winners.prizesCourtesy')} size="md" />
        </Card>
      ) : null}
      {byDate.size === 0 ? (
        <Card className="text-muted text-center">{t('winners.none')}</Card>
      ) : (
        [...byDate.entries()].map(([date, rows]) => (
          <section key={date} aria-labelledby={`d-${date}`}>
            <h2 id={`d-${date}`} className="mb-3 text-xl font-bold">
              {formatLongDate(date)}
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {rows.map((w) => (
                <li
                  key={w.position}
                  className="rounded-card border-line flex items-center gap-3 border bg-white p-4"
                >
                  <span className="bg-accent-100 text-accent-700 inline-flex size-11 shrink-0 items-center justify-center rounded-full font-bold">
                    <Trophy aria-hidden="true" className="mr-0.5 size-4" />
                    {w.position}
                  </span>
                  <span>
                    <span className="block text-lg font-bold">{w.first_name}</span>
                    <span className="text-muted font-mono">{w.masked_mobile}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
      <p className="text-muted text-sm">{t('winners.claimNote')}</p>
    </div>
  );
}
