import { z } from 'zod';

/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_ variables may appear
 * here. Next.js inlines them at build time, so each must be referenced by its
 * full literal name.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url().transform((u) => u.replace(/\/+$/, '')),
  NEXT_PUBLIC_WEB_VITALS: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WEB_VITALS: process.env.NEXT_PUBLIC_WEB_VITALS,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables: ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}. See .env.example.`,
    );
  }
  cached = parsed.data;
  return cached;
}
