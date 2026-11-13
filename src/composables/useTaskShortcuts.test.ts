import { describe, expect, it } from 'vitest'
import { addRecent, refreshIn, togglePinned, type TaskRef } from './useTaskShortcuts'

const task = (gid: string, name = `Task ${gid}`, completed = false): TaskRef => ({ gid, name, completed })

describe('addRecent', () => {
  it('puts the newest first', () => {
    expect(addRecent([task('1'), task('2')], task('3')).map((t) => t.gid)).toEqual(['3', '1', '2'])
  })
  it('moves an already listed task to the front instead of duplicating it', () => {
    expect(addRecent([task('1'), task('2'), task('3')], task('2')).map((t) => t.gid)).toEqual(['2', '1', '3'])
  })
  it('keeps the latest name', () => {
    expect(addRecent([task('1', 'old')], task('1', 'new'))[0].name).toBe('new')
  })
  it('caps the list', () => {
    const list = ['1', '2', '3'].map((gid) => task(gid))
    expect(addRecent(list, task('4'), 3).map((t) => t.gid)).toEqual(['4', '1', '2'])
  })
})

describe('togglePinned', () => {
  it('adds an unpinned task at the end', () => {
    expect(togglePinned([task('1')], task('2')).map((t) => t.gid)).toEqual(['1', '2'])
  })
  it('removes a pinned task', () => {
    expect(togglePinned([task('1'), task('2')], task('1')).map((t) => t.gid)).toEqual(['2'])
  })
})

describe('refreshIn', () => {
  it('updates name and completion in place without reordering', () => {
    const list = refreshIn([task('1'), task('2', 'old')], task('2', 'new', true))
    expect(list).toEqual([task('1'), task('2', 'new', true)])
  })
  it('does not add a task that is not listed', () => {
    expect(refreshIn([task('1')], task('9'))).toEqual([task('1')])
  })
})
