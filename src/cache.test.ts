import { describe, expect, it } from 'vitest'
import { staleBoardKeys } from './cache'

describe('staleBoardKeys', () => {
  const now = 100 * 86_400_000
  it('drops boards not saved for a month and boards saved before they carried a date', () => {
    const items: [unknown, unknown][] = [
      ['board:1:open', { savedAt: now - 5 * 86_400_000 }],
      ['board:2:open', { savedAt: now - 31 * 86_400_000 }],
      ['board:3:all', { sections: [] }],
    ]
    expect(staleBoardKeys(items, now)).toEqual(['board:2:open', 'board:3:all'])
  })
  it('leaves everything that is not a board alone', () => {
    expect(staleBoardKeys([['comment-counts', []], ['activity:9', {}], [42, null]], now)).toEqual([])
  })
})
