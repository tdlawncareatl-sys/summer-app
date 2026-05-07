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
      pendingEmail: '',
      authMessage: null,
      authError: null,
      requestEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
      clearPendingEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    expect(screen.getByRole('heading', { name: 'Sign in to Summer Plans' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeDisabled()
  })

  it('submits email sign-in from the signed-out state', async () => {
    const requestEmailCode = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({
      loading: false,
      session: null,
      profile: null,
      pendingProfile: false,
      authUser: null,
      pendingEmail: '',
      authMessage: null,
      authError: null,
      requestEmailCode,
      verifyEmailCode: vi.fn(),
      clearPendingEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'tad@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))

    await waitFor(() => {
      expect(requestEmailCode).toHaveBeenCalledWith('tad@example.com')
    })
  })

  it('shows code entry when an email is waiting for verification', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: null,
      profile: null,
      pendingProfile: false,
      authUser: null,
      pendingEmail: 'tad@example.com',
      authMessage: 'Code sent.',
      authError: null,
      requestEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
      clearPendingEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    expect(screen.getByText('Code sent.')).toBeInTheDocument()
    expect(screen.getByLabelText('Sign-in code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify code' })).toBeDisabled()
  })

  it('accepts longer email OTP codes instead of slicing to six digits', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: null,
      profile: null,
      pendingProfile: false,
      authUser: null,
      pendingEmail: 'tad@example.com',
      authMessage: 'Code sent.',
      authError: null,
      requestEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
      clearPendingEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    const input = screen.getByLabelText('Sign-in code') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12345678' } })

    expect(input.value).toBe('12345678')
    expect(screen.getByRole('button', { name: 'Verify code' })).toBeEnabled()
  })

  it('renders the profile setup screen when auth exists but app profile is pending', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: 'auth-1' } },
      profile: null,
      pendingProfile: true,
      authUser: { email: 'tad@example.com' },
      pendingEmail: '',
      authMessage: null,
      authError: null,
      requestEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
      clearPendingEmail: vi.fn(),
      completeProfile: vi.fn(),
    })

    render(<AppShell><div>App</div></AppShell>)

    expect(screen.getByRole('heading', { name: 'What name should we use here?' })).toBeInTheDocument()
    expect(screen.getByText('Signed in as tad@example.com')).toBeInTheDocument()
  })
})
