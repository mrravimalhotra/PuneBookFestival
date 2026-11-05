import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env-public';
import type { Database } from './database.types';

/**
 * Cookie-less anon client for cached public reads ('use cache' scopes cannot
 * read cookies). Sees only what RLS allows anon to see.
 */
let client: ReturnType<typeof createClient<Database>> | undefined;

export function createPublicClient() {
  if (client) return client;
  const env = publicEnv();
  client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Caching happens in our 'use cache' functions (tagged, invalidated on
    // admin saves). Keep these HTTP calls out of Next's fetch cache, which
    // persists across builds and could bake stale data into a new deploy.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return client;
}
