import 'server-only';
import { publicEnv } from '@/lib/env-public';

/** CSRF defence for JSON route handlers: require a same-origin Origin header. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === new URL(publicEnv().NEXT_PUBLIC_APP_URL).origin;
  } catch {
    return false;
  }
}
