'use client'

import { useAuth } from './auth'

export function useName() {
  const { profile, updateDisplayName } = useAuth()
  return [profile?.name ?? '', updateDisplayName] as const
}
