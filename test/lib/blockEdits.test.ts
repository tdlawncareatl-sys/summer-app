import { describe, expect, it } from 'vitest'
import { diffBlockEdit } from '@/lib/blockEdits'

const TODAY = '2026-07-15'

describe('diffBlockEdit', () => {
  const original = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']

  it('returns everything kept when nothing changes', () => {
    const diff = diffBlockEdit({
      originalDays: original,
      newStart: '2026-08-10',
      newEnd: '2026-08-13',
      todayISO: TODAY,
      blockedElsewhere: new Set(),
    })
    expect(diff).toEqual({ toRemove: [], toKeep: original, toInsert: [] })
  })

  it('shrinks: trims days off both ends', () => {
    const diff = diffBlockEdit({
      originalDays: original,
      newStart: '2026-08-11',
      newEnd: '2026-08-12',
      todayISO: TODAY,
      blockedElsewhere: new Set(),
    })
    expect(diff.toRemove).toEqual(['2026-08-10', '2026-08-13'])
    expect(diff.toKeep).toEqual(['2026-08-11', '2026-08-12'])
    expect(diff.toInsert).toEqual([])
  })

  it('expands: inserts the new days on both ends', () => {
    const diff = diffBlockEdit({
      originalDays: original,
      newStart: '2026-08-08',
      newEnd: '2026-08-15',
      todayISO: TODAY,
      blockedElsewhere: new Set(),
    })
    expect(diff.toRemove).toEqual([])
    expect(diff.toKeep).toEqual(original)
    expect(diff.toInsert).toEqual(['2026-08-08', '2026-08-09', '2026-08-14', '2026-08-15'])
  })

  it('moves: removes the old days and inserts the new ones', () => {
    const diff = diffBlockEdit({
      originalDays: original,
      newStart: '2026-09-01',
      newEnd: '2026-09-02',
      todayISO: TODAY,
      blockedElsewhere: new Set(),
    })
    expect(diff.toRemove).toEqual(original)
    expect(diff.toKeep).toEqual([])
    expect(diff.toInsert).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('never inserts into days blocked by another range', () => {
    const diff = diffBlockEdit({
      originalDays: original,
      newStart: '2026-08-08',
      newEnd: '2026-08-13',
      todayISO: TODAY,
      blockedElsewhere: new Set(['2026-08-08']),
    })
    expect(diff.toInsert).toEqual(['2026-08-09'])
  })

  it('never touches the past', () => {
    const diff = diffBlockEdit({
      originalDays: ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'],
      newStart: '2026-07-10',
      newEnd: '2026-07-15',
      todayISO: TODAY,
      blockedElsewhere: new Set(),
    })
    // Past days are neither removed nor inserted; only today's edge changes.
    expect(diff.toRemove).toEqual(['2026-07-16'])
    expect(diff.toKeep).toEqual(['2026-07-15'])
    expect(diff.toInsert).toEqual([])
  })

  it('handles reversed inputs the same as eachDay does', () => {
    const diff = diffBlockEdit({
      originalDays: original,
      newStart: '2026-08-13',
      newEnd: '2026-08-10',
      todayISO: TODAY,
      blockedElsewhere: new Set(),
    })
    expect(diff.toKeep).toEqual(original)
  })
})
