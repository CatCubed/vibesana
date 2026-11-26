import { describe, expect, it } from 'vitest'
import { findTrigger, stepActive } from './suggest'

describe('findTrigger', () => {
  it('finds a mention being typed, at the start or after a space', () => {
    expect(findTrigger('@jan')).toEqual({ kind: 'mention', query: 'jan', start: 0 })
    expect(findTrigger('ask @')).toEqual({ kind: 'mention', query: '', start: 4 })
    expect(findTrigger('line\n@lu')).toEqual({ kind: 'mention', query: 'lu', start: 5 })
  })
  it('finds an emoji name once two characters are typed', () => {
    expect(findTrigger('nice :ro')).toEqual({ kind: 'emoji', query: 'ro', start: 5 })
    expect(findTrigger('(:+1')).toEqual({ kind: 'emoji', query: '+1', start: 1 })
    expect(findTrigger('nice :r')).toBeNull()
  })
  it('ignores e-mail addresses, times and finished words', () => {
    expect(findTrigger('mail jan@example')).toBeNull()
    expect(findTrigger('at 10:30')).toBeNull()
    expect(findTrigger('@jan ')).toBeNull()
    expect(findTrigger('plain text')).toBeNull()
  })
})

describe('stepActive', () => {
  it('wraps around in both directions', () => {
    expect(stepActive(0, 1, 3)).toBe(1)
    expect(stepActive(2, 1, 3)).toBe(0)
    expect(stepActive(0, -1, 3)).toBe(2)
    expect(stepActive(0, 1, 0)).toBe(0)
  })
})
