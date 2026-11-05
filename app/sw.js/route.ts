import { serviceWorkerSource } from '@/lib/sw/source';

/**
 * Serves the service worker at /sw.js. Its source embeds the build id, so every
 * deploy produces a byte-different worker and clients see "New version available".
 */
export function GET() {
  return new Response(serviceWorkerSource(process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
