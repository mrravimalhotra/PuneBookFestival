import type { MetadataRoute } from 'next';
import { getPublicSettings } from '@/lib/data/public';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getPublicSettings();
  const name = s ? `${s.festival_name} ${s.festival_year}` : 'Book Festival';
  return {
    id: '/',
    name,
    short_name: s ? `${initials(s.festival_name)} ${s.festival_year}` : 'Festival',
    description: s ? `Register, get your QR entry pass and check in at ${s.venue}.` : undefined,
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fffdf9',
    theme_color: '#891a27',
    lang: 'en-IN',
    categories: ['events', 'books', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'My Pass',
        short_name: 'My Pass',
        url: '/saved-pass',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Self Check-in',
        short_name: 'Check in',
        url: '/checkin',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Staff Scanner',
        short_name: 'Scanner',
        url: '/staff/scan',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}

/** 'Pune Book Festival' -> 'PBF' (home-screen label must stay short). */
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 5);
}
