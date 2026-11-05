/* eslint-disable @next/next/no-img-element -- QR is an inline data URL generated on the server. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getPublicSettings } from '@/lib/data/public';
import { qrPngDataUrl } from '@/lib/qr';
import { venueCheckinUrl } from '@/lib/venue-qr';
import { Card, Skeleton } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Venue QR' };

export default function VenueQrPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Venue self check-in QR</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <VenueQr />
      </Suspense>
    </div>
  );
}

async function VenueQr() {
  const s = await getPublicSettings();
  if (!s) return <p>Settings unavailable.</p>;
  const url = venueCheckinUrl(s.festival_year);
  const qr = await qrPngDataUrl(url, 600);
  return (
    <Card className="max-w-xl space-y-4">
      <p>
        Print this poster and display it at the entrance. The code is signed for festival year{' '}
        {s.festival_year}; changing the year in settings (or rotating SELF_CHECKIN_SECRET)
        invalidates old posters.
      </p>
      <img src={qr} alt="Self check-in QR code" width={300} height={300} className="mx-auto" />
      <p className="text-muted text-sm break-all">{url}</p>
      <a
        href="/api/admin/venue-qr"
        className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center rounded-lg px-5 font-semibold text-white"
      >
        Download A4 poster (PDF)
      </a>
    </Card>
  );
}
