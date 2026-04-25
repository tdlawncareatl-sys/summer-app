import { describe, expect, it } from 'vitest'
import { categoryFor } from '@/lib/categories'
import { getIconDefinition } from '@/app/components/icons'

describe('categoryFor', () => {
  it('maps lake-themed plans to the custom lake icon family', () => {
    const category = categoryFor('Lake Weekend')

    expect(category).toMatchObject({
      icon: 'lakePlankRaft',
      tint: 'teal',
    })
    expect(getIconDefinition(category.icon).kind).toBe('scene')
  })

  it('maps movie titles to the movie-night illustration', () => {
    expect(categoryFor('Movie Night')).toMatchObject({
      icon: 'movieNight',
      tint: 'lavender',
    })
  })

  it('falls back to the calendar icon for unknown titles', () => {
    expect(categoryFor('Something brand new')).toMatchObject({
      icon: 'calendar',
      tint: 'olive',
    })
  })
})
