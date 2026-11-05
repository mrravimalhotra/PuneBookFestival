import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env-public';
import type { Database } from './database.types';

/**
 * Per-request client bound to the signed-in user's cookies. RLS applies as
 * that user. Use in Server Components, Server Actions and Route Handlers.
 */
export async function createClient() {
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are read-only there. The
            // proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
