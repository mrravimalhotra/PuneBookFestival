import { CalendarDays, Clock, MapPin, QrCode, Trophy, WifiOff } from 'lucide-react';
import { Suspense } from 'react';
import { t } from '@/lib/i18n';
import { formatDateRange, formatTime } from '@/lib/format';
import {
  getKeyPeople,
  getPartners,
  getPublicSettings,
  partnersFor,
  peopleFor,
} from '@/lib/data/public';
import { LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { PartnerLogo } from '@/components/brand/partner-logo';
import { SponsorWall } from '@/components/brand/partner-groups';
import { PeopleCards, WelcomeQuote } from '@/components/brand/people';

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>
      <Suspense fallback={<div className="h-64" aria-hidden="true" />}>
        <OrganisersAndSponsors />
      </Suspense>
      <Perks />
    </>
  );
}

async function Hero() {
  const [settings, partners] = await Promise.all([getPublicSettings(), getPartners()]);
  const title = partners.find(
    (p) => p.type === 'sponsor' && p.tier === 'title' && p.show_on.includes('home'),
  );

  if (!settings) {
    return (
      <section className="bg-brand-800 text-white">
        <div className="container-page py-16">
          <p className="text-lg">{t('errors.genericText')}</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-brand-800 relative overflow-hidden text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(229,154,18,0.35),transparent_55%)]"
        />
        <div className="container-page relative py-12 sm:py-20">
          <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
            {settings.registration_open ? t('home.heroKicker') : t('home.heroKickerClosed')}
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-bold sm:text-6xl">
            {settings.festival_name}{' '}
            <span className="text-accent-300">{settings.festival_year}</span>
          </h1>
          <dl className="mt-6 grid gap-3 text-lg sm:grid-cols-3 sm:gap-6">
            {[
              {
                icon: CalendarDays,
                label: t('home.dates'),
                value: formatDateRange(settings.start_date, settings.end_date),
              },
              {
                icon: Clock,
                label: t('home.timings'),
                value: t('common.dailyTimings', {
                  open: formatTime(settings.daily_open_time),
                  close: formatTime(settings.daily_close_time),
                }),
              },
              { icon: MapPin, label: t('home.venue'), value: settings.venue },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <dt>
                  <Icon aria-hidden="true" className="text-accent-300 size-6 shrink-0" />
                  <span className="sr-only">{label}</span>
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            {settings.registration_open ? (
              <LinkButton href="/register" variant="accent" size="lg">
                {t('common.registerNow')}
              </LinkButton>
            ) : null}
            <LinkButton
              href="/my-pass"
              variant="outline"
              size="lg"
              className="border-white/60 bg-transparent text-white hover:bg-white/10"
            >
              {t('common.myPass')}
            </LinkButton>
            <LinkButton
              href="/winners"
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10"
            >
              {t('common.winners')}
            </LinkButton>
          </div>
        </div>
      </section>
      {title ? (
        <section aria-labelledby="presented-by" className="border-line border-b bg-white">
          <div className="container-page flex flex-col items-center gap-2 py-6">
            <h2
              id="presented-by"
              className="text-muted text-xs font-bold tracking-widest uppercase"
            >
              {t('home.presentedBy')}
            </h2>
            <PartnerLogo partner={title} size="xl" priority />
            {title.tagline ? <p className="text-muted text-sm">{title.tagline}</p> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function HeroSkeleton() {
  return (
    <section className="bg-brand-800">
      <div className="container-page space-y-4 py-12 sm:py-20">
        <Skeleton className="h-7 w-48 bg-white/20" />
        <Skeleton className="h-14 w-3/4 bg-white/20" />
        <Skeleton className="h-24 w-full bg-white/10" />
      </div>
    </section>
  );
}

async function OrganisersAndSponsors() {
  const [people, partners] = await Promise.all([getKeyPeople(), getPartners()]);
  const homePeople = peopleFor(people, 'home');
  const lead = homePeople.find((p) => p.is_featured && p.short_message);
  const sponsors = partnersFor(partners, 'home', 'sponsor').filter((p) => p.tier !== 'title');

  return (
    <>
      {homePeople.length > 0 ? (
        <section aria-labelledby="meet-organisers" className="bg-paper py-12">
          <div className="container-page">
            <h2 id="meet-organisers" className="mb-6 text-center text-2xl font-bold sm:text-3xl">
              {t('home.meetOrganisers')}
            </h2>
            <PeopleCards people={homePeople} />
            {lead ? (
              <div className="mx-auto mt-8 max-w-3xl">
                <WelcomeQuote person={lead} />
              </div>
            ) : null}
            <p className="mt-6 text-center">
              <a
                href="/organisers"
                className="text-brand-700 font-semibold underline underline-offset-4"
              >
                {t('home.allOrganisers')}
              </a>
            </p>
          </div>
        </section>
      ) : null}
      {sponsors.length > 0 ? (
        <section aria-labelledby="partners" className="border-line border-t bg-white py-12">
          <div className="container-page">
            <h2 id="partners" className="mb-8 text-center text-2xl font-bold sm:text-3xl">
              {t('home.partnersTitle')}
            </h2>
            <SponsorWall sponsors={sponsors} />
          </div>
        </section>
      ) : null}
    </>
  );
}

function Perks() {
  const perks = [
    { icon: Trophy, title: t('home.perkDraw'), text: t('home.perkDrawText') },
    { icon: QrCode, title: t('home.perkQuick'), text: t('home.perkQuickText') },
    { icon: WifiOff, title: t('home.perkOffline'), text: t('home.perkOfflineText') },
  ];
  return (
    <section aria-labelledby="perks" className="border-line bg-paper border-t py-12">
      <div className="container-page">
        <h2 id="perks" className="mb-6 text-center text-2xl font-bold sm:text-3xl">
          {t('home.perksTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-card border-line border bg-white p-5">
              <Icon aria-hidden="true" className="text-brand-600 size-8" />
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="text-muted mt-1">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/register">{t('common.registerNow')}</LinkButton>
          <LinkButton href="/my-pass" variant="secondary">
            {t('home.findPass')}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
