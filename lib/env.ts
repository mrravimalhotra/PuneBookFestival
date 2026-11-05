import 'server-only';
import { z } from 'zod';
import { publicEnv, type PublicEnv } from './env-public';

/**
 * Server-only environment, validated once at startup (see instrumentation.ts).
 * Importing this module from a Client Component fails the build.
 */
const secret = z.string().min(32, 'must be at least 32 characters');

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PASS_TOKEN_SECRET: secret,
  SELF_CHECKIN_SECRET: secret,
  ADMIN_BOOTSTRAP_EMAIL: z.email().optional().or(z.literal('')),
  CLIENT_IP_HEADER: z.string().min(1).default('x-forwarded-for'),
  SENTRY_DSN: z.url().optional().or(z.literal('')),
});

export type ServerEnv = z.infer<typeof serverSchema> & PublicEnv;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PASS_TOKEN_SECRET: process.env.PASS_TOKEN_SECRET,
    SELF_CHECKIN_SECRET: process.env.SELF_CHECKIN_SECRET,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    CLIENT_IP_HEADER: process.env.CLIENT_IP_HEADER || undefined,
    SENTRY_DSN: process.env.SENTRY_DSN,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} (${i.message})`)
        .join(', ')}. See .env.example.`,
    );
  }
  if (parsed.data.PASS_TOKEN_SECRET === parsed.data.SELF_CHECKIN_SECRET) {
    throw new Error('PASS_TOKEN_SECRET and SELF_CHECKIN_SECRET must be different.');
  }
  cached = { ...parsed.data, ...publicEnv() };
  return cached;
}
