'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import { useAuth } from '@/lib/auth'

// Public routes that render without auth or the bottom nav. Add sparingly —
// reference / dev pages only, not real product surfaces.
const PUBLIC_ROUTES = new Set<string>()

const MIN_EMAIL_OTP_LENGTH = 6
const MAX_EMAIL_OTP_LENGTH = 10

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (PUBLIC_ROUTES.has(pathname)) return <>{children}</>

  const {
    loading,
    session,
    profile,
    pendingProfile,
    authUser,
    pendingEmail,
    authMessage,
    authError,
    requestEmailCode,
    verifyEmailCode,
    clearPendingEmail,
    completeProfile,
  } = useAuth()

  const [email, setEmail] = useState(authUser?.email ?? pendingEmail ?? '')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeEmail = email.trim() || pendingEmail
  const expectingCode = Boolean(pendingEmail)

  useEffect(() => {
    if (pendingEmail) {
      setEmail(pendingEmail)
    }
  }, [pendingEmail])

  async function handleEmailCodeRequest() {
    if (!email.trim() || submitting) return
    setSubmitting(true)
    try {
      await requestEmailCode(email)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCodeVerify() {
    if (!activeEmail || !code.trim() || submitting) return
    setSubmitting(true)
    try {
      await verifyEmailCode(activeEmail, code)
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
              Use your email and we&apos;ll send you a sign-in code. No password to remember.
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
            <button type="button"
              onClick={handleEmailCodeRequest}
              disabled={!email.trim() || submitting}
              className="mt-3 w-full rounded-[16px] bg-olive py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {submitting ? 'Sending code…' : expectingCode ? 'Resend code' : 'Email me a code'}
            </button>
            {expectingCode && (
              <div className="mt-4 rounded-[18px] bg-sand-alt p-4">
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">
                  Sign-in code
                </label>
                <input
                  type="text"
                  aria-label="Sign-in code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D+/g, '').slice(0, MAX_EMAIL_OTP_LENGTH))}
                  placeholder="Code"
                  autoComplete="one-time-code"
                  className="mt-2 w-full rounded-[16px] border-0 bg-white px-4 py-3 text-center text-lg font-semibold tracking-[0.18em] text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                />
                <button type="button"
                  onClick={handleCodeVerify}
                  disabled={code.trim().length < MIN_EMAIL_OTP_LENGTH || submitting}
                  className="mt-3 w-full rounded-[16px] bg-ink py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {submitting ? 'Checking code…' : 'Verify code'}
                </button>
                <button type="button"
                  onClick={() => {
                    clearPendingEmail()
                    setCode('')
                    setEmail('')
                  }}
                  className="mt-3 text-xs font-semibold text-olive"
                >
                  Use a different email
                </button>
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-ink-soft">
              Best for iPhone Home Screen use: stay in the app, check your email, then type the code back here.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-mute">
              Supabase codes can vary in length, so enter the full code exactly as it appears in the email.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-mute">
              If your email still shows a sign-in link instead of a code, open that link on this device while we finish the switch.
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
          <button type="button"
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
      {/* Bottom padding clears the floating nav (≈7rem) plus the iPhone home
          indicator. `safe-top` pads any iOS notch when the layout sits behind
          the status bar in PWA mode. */}
      <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))] safe-top">
        {children}
      </div>
      <BottomNav />
    </>
  )
}
