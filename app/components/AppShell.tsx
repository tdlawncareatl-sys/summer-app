'use client'

import { useState } from 'react'
import BottomNav from './BottomNav'
import { useAuth } from '@/lib/auth'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    loading,
    session,
    profile,
    pendingProfile,
    authUser,
    authMessage,
    authError,
    signInWithEmail,
    completeProfile,
  } = useAuth()

  const [email, setEmail] = useState(authUser?.email ?? '')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleEmailSignIn() {
    if (!email.trim() || submitting) return
    setSubmitting(true)
    try {
      await signInWithEmail(email)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleProfileSave() {
    if (!displayName.trim() || submitting) return
    setSubmitting(true)
    try {
      await completeProfile(displayName)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-5 py-10">
      <div className="max-w-md mx-auto animate-pulse">
          <div className="h-5 w-24 rounded-full bg-stone" />
          <div className="mt-3 h-12 w-52 rounded-[16px] bg-stone" />
          <div className="mt-8 h-72 rounded-[24px] bg-cream" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen px-5 py-8 flex items-center">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-6">
            <p className="text-sm font-semibold text-olive">Summer Plans</p>
            <h1 className="mt-2 font-serif text-[42px] leading-[1.02] font-black tracking-tight text-ink">
              Sign in to Summer Plans
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Use your email and we&apos;ll send you a magic link. No password to remember.
            </p>
          </div>

          <div className="rounded-[24px] border border-stone/70 bg-cream p-5 shadow-[var(--shadow-raised)]">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-2 w-full rounded-[16px] border-0 bg-sand px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
            />
            <button
              onClick={handleEmailSignIn}
              disabled={!email.trim() || submitting}
              className="mt-3 w-full rounded-[16px] bg-olive py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {submitting ? 'Sending link…' : 'Send sign-in link'}
            </button>
            <p className="mt-3 text-xs leading-5 text-ink-soft">
              Open the link from your email on this device to finish signing in.
            </p>
            {authMessage && (
              <p className="mt-3 rounded-[16px] bg-olive-soft px-3 py-2 text-xs font-medium text-olive">
                {authMessage}
              </p>
            )}
            {authError && (
              <p className="mt-3 rounded-[16px] bg-blush-soft px-3 py-2 text-xs font-medium text-blush">
                {authError}
              </p>
            )}
          </div>
        </div>
      </main>
    )
  }

  if (pendingProfile || !profile) {
    return (
      <main className="min-h-screen px-5 py-8 flex items-center">
        <div className="max-w-md mx-auto w-full rounded-[24px] border border-stone/70 bg-cream p-5 shadow-[var(--shadow-raised)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">One quick step</p>
          <h1 className="mt-2 font-serif text-[34px] leading-[1.05] font-black tracking-tight text-ink">
            What name should we use here?
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            This is the name people will see in Summer Plans.
          </p>
          <p className="mt-3 text-xs font-medium text-ink-mute">
            Signed in as {authUser?.email}
          </p>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Tad"
            autoFocus
            className="mt-4 w-full rounded-[16px] border-0 bg-sand px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
          />
          <button
            onClick={handleProfileSave}
            disabled={!displayName.trim() || submitting}
            className="mt-3 w-full rounded-[16px] bg-olive py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Finish setup'}
          </button>
          {authError && (
            <p className="mt-3 rounded-[16px] bg-blush-soft px-3 py-2 text-xs font-medium text-blush">
              {authError}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <>
      <div className="min-h-screen pb-28">{children}</div>
      <BottomNav />
    </>
  )
}
