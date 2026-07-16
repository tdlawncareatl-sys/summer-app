import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SchoolScheduleSheet from '@/app/components/SchoolScheduleSheet'
import { schoolById } from '@/lib/schoolCalendars'

// Sheet is pure selection UI — persistence lives on the Availability page and
// arrives here as onApply/onClear callbacks, so no Supabase mocking is needed.

function renderSheet(overrides: Partial<Parameters<typeof SchoolScheduleSheet>[0]> = {}) {
  const onApply = vi.fn().mockResolvedValue(undefined)
  const onClear = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <SchoolScheduleSheet
      todayISO="2026-07-15"
      nonSchoolBlocked={new Set<string>()}
      hasSchoolBlocks={false}
      onApply={onApply}
      onClear={onClear}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onApply, onClear, onClose }
}

describe('SchoolScheduleSheet', () => {
  it('walks school → review and saves the school-year blocks', async () => {
    const props = renderSheet()

    // Step 1 — all five schools are offered.
    expect(screen.getByText('Kennesaw State University')).toBeInTheDocument()
    expect(screen.getByText('Hillsdale College')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Wheaton College'))

    // Step 2 — review shows home breaks as free and summer as the tail.
    expect(screen.getByText('Does this look right?')).toBeInTheDocument()
    expect(screen.getByText('Thanksgiving break')).toBeInTheDocument()
    expect(screen.getByText('Winter break')).toBeInTheDocument()
    expect(screen.getByText('Home for summer')).toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: /Block \d+ days/ })
    fireEvent.click(saveButton)

    expect(props.onApply).toHaveBeenCalledTimes(1)
    const [school, days] = props.onApply.mock.calls[0]
    expect(school).toBe(schoolById('wheaton'))
    expect(days).toContain('2026-08-26') // first day of classes
    expect(days).not.toContain('2026-11-26') // Thanksgiving stays free
  })

  it('drops a skipped stretch from the days it saves', () => {
    const props = renderSheet()
    fireEvent.click(screen.getByText('Kennesaw State University'))

    // Skip the first "At school" stretch (Aug 24 – Nov 20).
    fireEvent.click(screen.getAllByText('At school')[0])
    expect(screen.getByText('Skipped')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Block \d+ days/ }))
    const [, days] = props.onApply.mock.calls[0]
    expect(days).not.toContain('2026-09-01')
    expect(days).toContain('2026-11-30') // post-Thanksgiving stretch still blocks
  })

  it('shows the remove action only when school blocks exist', () => {
    const props = renderSheet({ hasSchoolBlocks: true })
    fireEvent.click(screen.getByText('Remove my current school blocks'))
    expect(props.onClear).toHaveBeenCalledTimes(1)
  })
})
