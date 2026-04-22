import { supabase } from './supabase'

export async function ensureUser(name: string): Promise<string> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('name', name)
    .single()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('users')
    .insert({ name, email: `${name.toLowerCase().replace(/[\s&]+/g, '.')}@summer.app` })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create user: ${error.message}`)
  return created!.id
}
