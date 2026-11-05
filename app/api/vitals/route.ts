import { z } from 'zod';
import { log } from '@/lib/logger';

const metricSchema = z.object({
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  id: z.string().max(100),
  path: z.string().max(200),
});

/** Web Vitals sink (enabled with NEXT_PUBLIC_WEB_VITALS=true). Logs metrics only, no personal data. */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_WEB_VITALS !== 'true') return new Response(null, { status: 204 });
  const parsed = metricSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) log.info('web_vitals', parsed.data);
  return new Response(null, { status: 204 });
}
