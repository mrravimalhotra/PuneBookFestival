import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Service-role client. SERVER ONLY. Bypasses RLS, so it is used for exactly:
 *   - calling the public attendee RPCs (register, find/get pass, self check-in,
 *     rate limiting) after server-side validation, and
 *   - Supabase Admin API calls (creating staff accounts, bootstrap admin).
 * Never pass its results to the client unfiltered.
 */
let client: ReturnType<typeof createClient<Database>> | undefined;

export function createServiceClient() {
  if (client) return client;
  const env = serverEnv();
  client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application': 'pbf-server' } },
  });
  return client;
}
