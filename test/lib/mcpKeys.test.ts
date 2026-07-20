import { describe, expect, it } from 'vitest'
import { connectorUrl, deriveFriendKey, findFriendForKey, secretMatches } from '../../lib/mcp/keys'
import { groupIntoRanges, formatRange } from '../../lib/mcp/ranges'

const SECRET = 'test-secret'
const friends = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Tad' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Grace' },
]

describe('deriveFriendKey', () => {
  it('is deterministic for the same secret + user', () => {
    expect(deriveFriendKey(SECRET, friends[0].id)).toBe(deriveFriendKey(SECRET, friends[0].id))
  })

  it('differs per friend and per secret', () => {
    const a = deriveFriendKey(SECRET, friends[0].id)
    expect(a).not.toBe(deriveFriendKey(SECRET, friends[1].id))
    expect(a).not.toBe(deriveFriendKey('other-secret', friends[0].id))
  })

  it('is URL-safe hex, 24 chars', () => {
    expect(deriveFriendKey(SECRET, friends[0].id)).toMatch(/^[0-9a-f]{24}$/)
  })
})

describe('findFriendForKey', () => {
  it('resolves each friend from their own key', () => {
    for (const friend of friends) {
      const key = deriveFriendKey(SECRET, friend.id)
      expect(findFriendForKey(friends, SECRET, key)?.name).toBe(friend.name)
    }
  })

  it('rejects unknown, truncated, and wrong-secret keys', () => {
    expect(findFriendForKey(friends, SECRET, 'deadbeefdeadbeefdeadbeef')).toBeNull()
    expect(findFriendForKey(friends, SECRET, deriveFriendKey(SECRET, friends[0].id).slice(0, 23))).toBeNull()
    expect(findFriendForKey(friends, SECRET, deriveFriendKey('other-secret', friends[0].id))).toBeNull()
    expect(findFriendForKey(friends, SECRET, '')).toBeNull()
  })
})

describe('secretMatches', () => {
  it('accepts only the exact secret', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true)
    expect(secretMatches(SECRET, SECRET + 'x')).toBe(false)
    expect(secretMatches(SECRET, '')).toBe(false)
  })
})

describe('connectorUrl', () => {
  it('builds the paste-into-claude link', () => {
    expect(connectorUrl('https://summoreplans.com', 'abc123')).toBe(
      'https://summoreplans.com/api/mcp?key=abc123',
    )
  })
})

describe('groupIntoRanges', () => {
  it('merges consecutive days with the same category', () => {
    const ranges = groupIntoRanges([
      { date: '2026-07-21', category: null },
      { date: '2026-07-22', category: null },
      { date: '2026-07-23', category: null },
    ])
    expect(ranges).toEqual([
      { startDate: '2026-07-21', endDate: '2026-07-23', days: 3, category: null },
    ])
  })

  it('splits on gaps and category changes, and sorts input', () => {
    const ranges = groupIntoRanges([
      { date: '2026-08-12', category: 'School · KSU' },
      { date: '2026-07-21', category: null },
      { date: '2026-08-11', category: 'School · KSU' },
      { date: '2026-07-22', category: 'Beach trip' },
    ])
    expect(ranges).toEqual([
      { startDate: '2026-07-21', endDate: '2026-07-21', days: 1, category: null },
      { startDate: '2026-07-22', endDate: '2026-07-22', days: 1, category: 'Beach trip' },
      { startDate: '2026-08-11', endDate: '2026-08-12', days: 2, category: 'School · KSU' },
    ])
  })

  it('ignores duplicate date rows', () => {
    const ranges = groupIntoRanges([
      { date: '2026-07-21', category: null },
      { date: '2026-07-21', category: null },
    ])
    expect(ranges).toEqual([
      { startDate: '2026-07-21', endDate: '2026-07-21', days: 1, category: null },
    ])
  })

  it('spans a month boundary', () => {
    const ranges = groupIntoRanges([
      { date: '2026-07-31', category: null },
      { date: '2026-08-01', category: null },
    ])
    expect(ranges).toHaveLength(1)
    expect(ranges[0].endDate).toBe('2026-08-01')
  })
})

describe('formatRange', () => {
  it('formats single days, ranges, and categories', () => {
    expect(formatRange({ startDate: '2026-07-21', endDate: '2026-07-21', days: 1, category: null })).toBe('2026-07-21')
    expect(formatRange({ startDate: '2026-07-21', endDate: '2026-07-23', days: 3, category: 'Beach trip' })).toBe(
      '2026-07-21 → 2026-07-23 (3 days) · Beach trip',
    )
  })
})
