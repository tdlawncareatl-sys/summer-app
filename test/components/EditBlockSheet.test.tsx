import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditBlockSheet from '@/app/components/EditBlockSheet'

// Pure selection UI — persistence arrives as onSave/onRemove callbacks.

const BLOCK = {
  start: '2026-08-10',
  end: '2026-08-13',
  days: ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'],
  category: 'Beach trip',
}

function renderSheet(block = BLOCK) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onRemove = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <EditBlockSheet block={block} todayISO="2026-07-15" onSave={onSave} onRemove={onRemove} onClose={onClose} />,
  )
  return { onSave, onRemove, onClose }
}

describe('EditBlockSheet', () => {
  it('disables save until something changes, then saves the new dates', () => {
    const { onSave } = renderSheet()
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-08-15' } })
    expect(screen.getByText('Blocks 6 days')).toBeInTheDocument()
    expect(save).toBeEnabled()

    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith({ start: '2026-08-10', end: '2026-08-15', category: 'Beach trip' })
  })

  it('saves a label-only change, trimming to null when emptied', () => {
    const { onSave } = renderSheet()
    fireEvent.change(screen.getByPlaceholderText('e.g. Beach trip, Work travel, Family'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith({ start: '2026-08-10', end: '2026-08-13', category: null })
  })

  it('blocks saving a reversed range and explains why', () => {
    const { onSave } = renderSheet()
    fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-08-20' } })
    expect(screen.getByText('The last day is before the first day.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('offers remove', () => {
    const { onRemove } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Remove block' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
