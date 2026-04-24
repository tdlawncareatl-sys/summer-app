import { supabase } from './supabase'

export async function ensureUser(name: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(`Failed to read auth user: ${authError.message}`)

  const email = authData.user?.email?.trim().toLowerCase()
  if (!email) throw new Error('You need to sign in before creating app data.')

  const { data: existingByEmail, error: existingByEmailError } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle()

  if (existingByEmailError) {
    throw new Error(`Failed to look up your profile: ${existingByEmailError.message}`)
  }

  if (existingByEmail) {
    if (existingByEmail.name !== trimmed) {
      const { error: renameError } = await supabase
        .from('users')
        .update({ name: trimmed })
        .eq('id', existingByEmail.id)

      if (renameError) throw new Error(`Failed to update your profile: ${renameError.message}`)
    }

    return existingByEmail.id
  }

  const { data: legacyMatches, error: legacyError } = await supabase
    .from('users')
    .select('id, email')
    .eq('name', trimmed)
    .limit(2)

  if (legacyError) throw new Error(`Failed to look up existing names: ${legacyError.message}`)

  if ((legacyMatches?.length ?? 0) === 1) {
    const legacy = legacyMatches![0]
    const placeholderEmail = legacy.email.endsWith('@summer.app')

    if (placeholderEmail) {
      const { error: claimError } = await supabase
        .from('users')
        .update({ email, name: trimmed })
        .eq('id', legacy.id)

      if (claimError) throw new Error(`Failed to connect your existing profile: ${claimError.message}`)
      return legacy.id
    }
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ name: trimmed, email })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create user: ${error.message}`)
  return created!.id
}
