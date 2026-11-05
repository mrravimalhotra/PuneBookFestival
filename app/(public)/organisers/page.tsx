import type { Metadata } from 'next';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import {
  getKeyPeople,
  getPartners,
  getPublicSettings,
  partnersFor,
  peopleFor,
} from '@/lib/data/public';
import { Card, PageTitle, Skeleton } from '@/components/ui/card';
import { LogoStrip } from '@/components/brand/partner-groups';
import { PersonPhoto } from '@/components/brand/person-photo';

export const metadata: Metadata = { title: t('meta.organisersTitle') };

export default function OrganisersPage() {
  return (
    <div className="container-page max-w-5xl py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrganisersContent />
      </Suspense>
    </div>
  );
}

async function OrganisersContent() {
  const [settings, people, partners] = await Promise.all([
    getPublicSettings(),
    getKeyPeople(),
    getPartners(),
  ]);
  const list = peopleFor(people, 'about');
  return (
    <>
      <PageTitle>{t('organisers.title')}</PageTitle>
      {settings ? (
        <p className="text-muted mt-2">
          {t('organisers.intro', {
            festival: settings.festival_name,
            year: settings.festival_year,
          })}
        </p>
      ) : null}
      {list.length === 0 ? (
        <Card className="text-muted mt-6 text-center">{t('organisers.none')}</Card>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {list.map((p, i) => (
            <li
              key={p.id}
              className="rounded-card border-line flex flex-col items-center gap-4 border bg-white p-6 text-center sm:flex-row sm:items-start sm:text-left"
            >
              <PersonPhoto person={p} size={160} priority={i < 2} rounded="xl" />
              <div>
                <h2 className="text-xl font-bold">{p.full_name}</h2>
                <p className="text-muted">{p.designation}</p>
                {p.organisation ? <p className="text-muted">{p.organisation}</p> : null}
                {p.short_message ? (
                  <blockquote className="border-accent-300 mt-3 border-l-4 pl-3 italic">
                    “{p.short_message}”
                  </blockquote>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10">
        <LogoStrip
          partners={partnersFor(partners, 'home', 'organiser')}
          label={t('footer.organisedBy')}
          size="lg"
        />
      </div>
    </>
  );
}
