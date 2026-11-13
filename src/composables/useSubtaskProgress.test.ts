import { describe, expect, it } from 'vitest'
import { countProgress, isFresh } from './useSubtaskProgress'

describe('countProgress', () => {
  it('counts finished and total subtasks', () => {
    expect(countProgress([{ completed: true }, { completed: false }, { completed: true }])).toEqual({ done: 2, total: 3 })
  })
  it('ignores section rows', () => {
    expect(
      countProgress([
        { completed: false, is_rendered_as_separator: true },
        { completed: true },
        { completed: true, is_rendered_as_separator: true },
      ]),
    ).toEqual({ done: 1, total: 1 })
  })
  it('handles no subtasks', () => {
    expect(countProgress([])).toEqual({ done: 0, total: 0 })
  })
})

describe('isFresh', () => {
  const now = 1_000_000
  it('accepts a recent count for an unchanged task', () => {
    expect(isFresh({ modified: 'a', at: now - 1000 }, 'a', now)).toBe(true)
  })
  it('rejects a count when the task changed', () => {
    expect(isFresh({ modified: 'a', at: now - 1000 }, 'b', now)).toBe(false)
  })
  it('rejects a count older than ten minutes', () => {
    expect(isFresh({ modified: 'a', at: now - 11 * 60_000 }, 'a', now)).toBe(false)
  })
  it('rejects a missing count', () => {
    expect(isFresh(undefined, 'a', now)).toBe(false)
  })
})
