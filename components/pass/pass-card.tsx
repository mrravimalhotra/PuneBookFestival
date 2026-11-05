/* eslint-disable @next/next/no-img-element -- the pass must render offline and inside PNG/PDF exports, where /_next/image is unavailable; images have explicit sizes. */
import { forwardRef } from 'react';
import { formatDateRange, formatDay, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { PassSnapshot } from '@/lib/pass-types';

/**
 * Presentational pass. Works in Server and Client Components (no server-only
 * imports) so the same markup is used online, offline and in downloads.
 * Large type and high contrast for bright sunlight.
 */
export const PassCard = forwardRef<
  HTMLDivElement,
  { pass: PassSnapshot; status?: React.ReactNode }
>(function PassCard({ pass, status }, ref) {
  return (
    <div
      ref={ref}
      className="rounded-card border-brand-800 text-ink mx-auto w-full max-w-sm overflow-hidden border-2 bg-white shadow-lg"
    >
      <div className="bg-brand-800 px-5 py-4 text-white">
        <p className="text-sm font-semibold tracking-widest uppercase opacity-90">
          {t('pass.title')}
        </p>
        <p className="text-2xl leading-tight font-bold">
          {pass.festivalName} {pass.festivalYear}
        </p>
        <p className="text-sm opacity-90">
          {formatDateRange(pass.startDate, pass.endDate)} · {formatTime(pass.openTime)}–
          {formatTime(pass.closeTime)}
        </p>
        <p className="text-sm opacity-90">{pass.venue}</p>
      </div>
      <div className="flex flex-col items-center px-5 pt-5">
        <img
          src={pass.qrDataUrl}
          alt={t('pass.qrAlt', { code: pass.passCode })}
          width={256}
          height={256}
          className="size-64 [image-rendering:pixelated]"
        />
        <p className="mt-3 text-center text-3xl leading-tight font-bold break-words">
          {pass.fullName}
        </p>
        <p className="text-muted mt-1 text-sm font-semibold tracking-wide uppercase">
          {t('pass.passCode')}
        </p>
        <p className="font-mono text-3xl font-bold tracking-wider">{pass.passCode}</p>
      </div>
      <div className="px-5 pt-4">
        <p className="text-muted text-center text-sm font-semibold tracking-wide uppercase">
          {t('pass.yourDates')}
        </p>
        <ul className="mt-2 flex flex-wrap justify-center gap-2">
          {pass.dates.map((d) => (
            <li
              key={d}
              className="bg-accent-100 text-accent-700 rounded-full px-3 py-1 text-base font-bold"
            >
              {formatDay(d)}
            </li>
          ))}
        </ul>
      </div>
      {status ? <div className="px-5 pt-4">{status}</div> : null}
      {pass.sponsors.length > 0 ? (
        <div className="border-line mt-5 border-t px-5 py-4">
          <p className="text-muted text-center text-xs font-bold tracking-widest uppercase">
            {t('pass.supportedBy')}
          </p>
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-3">
            {pass.sponsors.map((s) => (
              <li key={s.id} className="flex h-12 w-28 items-center justify-center">
                <img
                  src={s.logoUrl}
                  alt={t('common.logoOf', { name: s.name })}
                  width={112}
                  height={48}
                  className="max-h-12 max-w-28 object-contain"
                  crossOrigin="anonymous"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
});
