import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { optionalEnv, requireEnv } from './env'

let cached: SupabaseClient | null = null

/**
 * Returns a lazily constructed, server-only Supabase client.
 *
 * Prefers SUPABASE_SERVICE_ROLE_KEY so row-level security can deny anonymous
 * access outright: the anon key ships to the browser, so any policy permissive
 * enough for direct client writes is equally open to anyone reading the bundle.
 * All writes go through route handlers using this client instead.
 *
 * Falls back to the anon key so an existing deployment keeps working before the
 * service-role key is configured; see README for the RLS migration.
 */
export function getSupabase(): SupabaseClient {
  if (!cached) {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = optionalEnv('SUPABASE_SERVICE_ROLE_KEY')
    const key = serviceKey ?? requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    if (!serviceKey && process.env.NODE_ENV === 'production') {
      console.warn(
        '[opswatch] SUPABASE_SERVICE_ROLE_KEY is not set; falling back to the anon key. ' +
          'Set it and lock down RLS before exposing this deployment.'
      )
    }

    cached = createClient(url, key, { auth: { persistSession: false } })
  }
  return cached
}

/** Test seam: clears the cached client so env changes take effect. */
export function resetSupabase(): void {
  cached = null
}
