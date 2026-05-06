import { createClient } from '@supabase/supabase-js'

export function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for notification dispatch.')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}
