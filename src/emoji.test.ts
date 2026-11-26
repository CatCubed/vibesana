import { describe, expect, it } from 'vitest'
import { EMOJI, emojiFor, emojiMatches } from './emoji'

describe('emoji', () => {
  it('finds an emoji by name and nothing for unknown or inherited names', () => {
    expect(emojiFor('rocket')).toBe('🚀')
    expect(emojiFor('+1')).toBe('👍')
    expect(emojiFor('nope')).toBeNull()
    expect(emojiFor('constructor')).toBeNull()
  })
  it('suggests names that start with the query first, then ones containing it', () => {
    const names = emojiMatches('sm').map((m) => m.name)
    expect(names[0]).toBe('smile')
    expect(names).toContain('smirk')
    expect(names.indexOf('smirk')).toBeLessThan(names.indexOf('sweat_smile'))
  })
  it('lists an emoji once even when it has two names, and respects the limit', () => {
    expect(emojiMatches('thumbs').map((m) => m.emoji)).toEqual(['👍', '👎'])
    expect(emojiMatches('', 5)).toHaveLength(5)
  })
  it('has only lower-case names made of safe characters', () => {
    for (const name of Object.keys(EMOJI)) expect(name).toMatch(/^[a-z0-9_+-]+$/)
  })
})
