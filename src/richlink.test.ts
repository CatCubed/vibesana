import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './richlink'

describe('normalizeUrl', () => {
  it.each([
    ['https://asana.com/x', 'https://asana.com/x'],
    ['http://example.com', 'http://example.com'],
    ['  example.com/page ', 'https://example.com/page'],
    ['localhost:5199/board', 'https://localhost:5199/board'],
    ['mailto:a@b.cz', 'mailto:a@b.cz'],
    ['jan.novak@example.com', 'mailto:jan.novak@example.com'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })
  it.each(['', '   ', 'javascript:alert(1)', 'file:///etc/passwd', 'two words', 'data:text/html,x'])('rejects %j', (input) => {
    expect(normalizeUrl(input)).toBeNull()
  })
})
