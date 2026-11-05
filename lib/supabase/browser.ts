'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env-public';
import type { Database } from './database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (client) return client;
  const env = publicEnv();
  client = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
