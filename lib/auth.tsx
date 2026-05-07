'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { EmailOtpType, Session, User as SupabaseUser } from '@supabase/supabase-js'
import { ensureUser } from './ensureUser'
import { supabase } from './supabase'

type AppProfile = {
  id: string
  name: string
  email: string
  avatar_url?: string | null
}

type AuthContextValue = {
  session: Session | null
  authUser: SupabaseUser | null
  profile: AppProfile | null
  loading: boolean
  pendingProfile: boolean
  pendingEmail: string
  authMessage: string | null
  authError: string | null
  requestEmailCode: (email: string) => Promise<void>
  verifyEmailCode: (email: string, code: string) => Promise<void>
  clearPendingEmail: () => void
  completeProfile: (name: string) => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type UserRow = {
  id: string
  name: string
  email: string
  avatar_url?: string | null
}

async function loadProfileForEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

const PENDING_EMAIL_KEY = 'summer-app-pending-email'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingProfile, setPendingProfile] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  function storePendingEmail(email: string) {
    setPendingEmail(email)
    if (typeof window !== 'undefined') {
      if (email) {
        window.localStorage.setItem(PENDING_EMAIL_KEY, email)
      } else {
        window.localStorage.removeItem(PENDING_EMAIL_KEY)
      }
    }
  }

  async function syncFromSession(nextSession: Session | null) {
    setSession(nextSession)
    setAuthUser(nextSession?.user ?? null)

    if (!nextSession?.user?.email) {
      setProfile(null)
      setPendingProfile(false)
      if (typeof window !== 'undefined') {
        const storedEmail = window.localStorage.getItem(PENDING_EMAIL_KEY) ?? ''
        setPendingEmail(storedEmail)
      }
      setLoading(false)
      return
    }

    try {
      const nextProfile = await loadProfileForEmail(nextSession.user.email)
      setProfile(nextProfile)
      setPendingProfile(!nextProfile)
      storePendingEmail('')
      setAuthMessage(null)
      setAuthError(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not load your profile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    if (typeof window !== 'undefined') {
      setPendingEmail(window.localStorage.getItem(PENDING_EMAIL_KEY) ?? '')
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setAuthError(error.message)
        setLoading(false)
        return
      }
      void syncFromSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      void syncFromSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function requestEmailCode(email: string) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setAuthError(null)
    setAuthMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      setAuthError(error.message)
      throw error
    }

    storePendingEmail(trimmed)
    setAuthMessage(`Code sent to ${trimmed}. Enter the 6-digit code here to finish signing in.`)
  }

  async function verifyEmailCode(email: string, code: string) {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedCode = code.replace(/\s+/g, '')
    if (!trimmedEmail || !trimmedCode) return

    setAuthError(null)
    setAuthMessage(null)

    // Some Supabase project states still treat first-time passwordless users as a
    // signup confirmation flow rather than a plain email OTP flow. Try the current
    // email OTP type first, then fall back to signup so new users do not get stuck.
    const verificationTypes: EmailOtpType[] = ['email', 'signup', 'magiclink']
    let lastError: Error | null = null

    for (const verificationType of verificationTypes) {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedCode,
        type: verificationType,
      })

      if (!error) return
      lastError = error
    }

    if (lastError) {
      setAuthError(lastError.message)
      throw lastError
    }
  }

  function clearPendingEmail() {
    storePendingEmail('')
    setAuthMessage(null)
    setAuthError(null)
  }

  async function completeProfile(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    setAuthError(null)

    try {
      const id = await ensureUser(trimmed)
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('id', id)
        .single()

      if (error) throw error

      await supabase.auth.updateUser({
        data: { name: data.name },
      })

      setProfile(data)
      setPendingProfile(false)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not save your profile.')
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function updateDisplayName(name: string) {
    const trimmed = name.trim()
    if (!trimmed || !profile) return
    if (trimmed === profile.name) return

    setLoading(true)
    setAuthError(null)

    try {
      const oldName = profile.name

      const { error: profileError } = await supabase
        .from('users')
        .update({ name: trimmed })
        .eq('id', profile.id)

      if (profileError) throw profileError

      const renameResults = await Promise.all([
        supabase.from('events').update({ created_by: trimmed }).eq('created_by', oldName),
        supabase.from('ideas').update({ submitted_by: trimmed }).eq('submitted_by', oldName),
        supabase.from('date_options').update({ created_by: trimmed }).eq('created_by', oldName),
      ])

      const renameError = renameResults.find((result) => result.error)?.error
      if (renameError) throw renameError

      await supabase.auth.updateUser({
        data: { name: trimmed },
      })

      setProfile((current) => current ? { ...current, name: trimmed } : current)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not update your name.')
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (!authUser?.email) return
    setLoading(true)
    try {
      const nextProfile = await loadProfileForEmail(authUser.email)
      setProfile(nextProfile)
      setPendingProfile(!nextProfile)
      setAuthError(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not refresh your profile.')
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    setAuthError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
      throw error
    }
    setAuthMessage(null)
  }

  const value = useMemo<AuthContextValue>(() => ({
    session,
    authUser,
    profile,
    loading,
    pendingProfile,
    pendingEmail,
    authMessage,
    authError,
    requestEmailCode,
    verifyEmailCode,
    clearPendingEmail,
    completeProfile,
    updateDisplayName,
    signOut,
    refreshProfile,
  }), [session, authUser, profile, loading, pendingProfile, pendingEmail, authMessage, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
