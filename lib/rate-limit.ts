import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { serverEnv } from '@/lib/env';
import { log } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

export const LIMITS = {
  register: { limit: 10, windowSeconds: 600 },
  myPass: { limit: 20, windowSeconds: 600 },
  selfCheckin: { limit: 20, windowSeconds: 300 },
  passView: { limit: 120, windowSeconds: 60 },
} as const;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const raw = h.get(serverEnv().CLIENT_IP_HEADER) ?? h.get('x-real-ip') ?? '';
  return raw.split(',')[0]?.trim() || 'unknown';
}

/** IPs are hashed before storage so the limiter table holds no raw addresses. */
function hashKey(scope: string, ip: string): string {
  return `${scope}:${createHash('sha256').update(ip).digest('base64url').slice(0, 22)}`;
}

/**
 * Table-based fixed-window limiter (works on any host, no vendor lock-in).
 * Fails open if the database call errors, so an outage of the limiter never
 * blocks registrations; the failure is logged.
 */
export async function rateLimit(scope: keyof typeof LIMITS): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[scope];
  const ip = await clientIp();
  const { data, error } = await createServiceClient().rpc('rate_limit_hit', {
    p_key: hashKey(scope, ip),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    log.warn('rate_limit.error', { scope, code: error.code });
    return true;
  }
  return data === true;
}
