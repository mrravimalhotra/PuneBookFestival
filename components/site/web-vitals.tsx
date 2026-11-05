'use client';
import { useReportWebVitals } from 'next/web-vitals';

/** Sends Core Web Vitals to /api/vitals when NEXT_PUBLIC_WEB_VITALS=true. */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NEXT_PUBLIC_WEB_VITALS !== 'true') return;
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      path: window.location.pathname.replace(/\/pass\/[^/]+/, '/pass/[token]'),
    });
    if (!navigator.sendBeacon?.('/api/vitals', body)) {
      fetch('/api/vitals', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  });
  return null;
}
