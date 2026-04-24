import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '@/app/components/AppShell'

const useAuthMock = vi.fn()

vi.mock('@/lib/auth', () => ({
  useAuth: () => useAuthMock(),
}))

describe('AppShell', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('renders the sign-in screen when there is no session', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: null,
      profile: null,
      pendingProfile: false,
      authUser: null,
      authMessage: null,
      authError: null,
      signInWithEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    expect(screen.getByRole('heading', { name: 'Sign in to Summer Plans' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send sign-in link' })).toBeDisabled()
  })

  it('submits email sign-in from the signed-out state', async () => {
    const signInWithEmail = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({
      loading: false,
      session: null,
      profile: null,
      pendingProfile: false,
      authUser: null,
      authMessage: null,
      authError: null,
      signInWithEmail,
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'tad@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))

    await waitFor(() => {
      expect(signInWithEmail).toHaveBeenCalledWith('tad@example.com')
    })
  })

  it('renders the profile setup screen when auth exists but app profile is pending', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: 'auth-1' } },
      profile: null,
      pendingProfile: true,
      authUser: { email: 'tad@example.com' },
      authMessage: null,
      authError: null,
      signInWithEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    expect(screen.getByRole('heading', { name: 'What name should we use here?' })).toBeInTheDocument()
    expect(screen.getByText('Signed in as tad@example.com')).toBeInTheDocument()
  })
})
