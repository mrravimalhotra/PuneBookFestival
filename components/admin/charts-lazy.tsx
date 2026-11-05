'use client';

import dynamic from 'next/dynamic';

// Recharts loads only on the dashboard, never in public bundles.
const fallback = () => (
  <div className="rounded-card h-[22rem] animate-pulse bg-stone-100" aria-hidden="true" />
);
export const RegistrationsChart = dynamic(
  () => import('./charts').then((m) => m.RegistrationsChart),
  { ssr: false, loading: fallback },
);
export const FootfallChart = dynamic(() => import('./charts').then((m) => m.FootfallChart), {
  ssr: false,
  loading: fallback,
});
