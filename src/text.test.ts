import { describe, expect, it } from 'vitest'
import { withoutAuthor } from './text'

describe('withoutAuthor', () => {
  it('drops a leading author name', () => {
    expect(withoutAuthor('Ann Lee assigned to you', 'Ann Lee')).toBe('assigned to you')
  })
  it('leaves text that does not start with the name', () => {
    expect(withoutAuthor('changed status', 'Ann Lee')).toBe('changed status')
    expect(withoutAuthor('Ann Leeson moved this', 'Ann Lee')).toBe('Ann Leeson moved this')
  })
  it('leaves text alone without an author', () => {
    expect(withoutAuthor('Asana changed AIS', null)).toBe('Asana changed AIS')
  })
})
