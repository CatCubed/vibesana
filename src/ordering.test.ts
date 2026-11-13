import { describe, expect, it } from 'vitest'
import { anchorFor, isNoopMove, landingIndex, moveItem } from './ordering'

describe('landingIndex', () => {
  it('shifts down by one when moving later in the same list', () => {
    expect(landingIndex(true, 1, 4)).toBe(3)
  })
  it('keeps the index when moving earlier in the same list', () => {
    expect(landingIndex(true, 4, 1)).toBe(1)
  })
  it('keeps the index when moving to another list', () => {
    expect(landingIndex(false, 1, 4)).toBe(4)
  })
})

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd']

  it('moves an item down to a later gap', () => {
    expect(moveItem(list, 0, 3)).toEqual({ list: ['b', 'c', 'a', 'd'], index: 2 })
  })
  it('moves an item to the very end', () => {
    expect(moveItem(list, 1, 4)).toEqual({ list: ['a', 'c', 'd', 'b'], index: 3 })
  })
  it('moves an item up to an earlier gap', () => {
    expect(moveItem(list, 3, 1)).toEqual({ list: ['a', 'd', 'b', 'c'], index: 1 })
  })
  it('leaves the list alone for the gaps next to the item', () => {
    expect(isNoopMove(2, 2)).toBe(true)
    expect(isNoopMove(2, 3)).toBe(true)
    expect(moveItem(list, 2, 3).list).toEqual(list)
  })
  it('does not mutate the input', () => {
    moveItem(list, 0, 4)
    expect(list).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('anchorFor', () => {
  it('anchors after the previous item when there is one', () => {
    expect(anchorFor(['a', 'b', 'c'], 1)).toEqual({ after: 'a' })
  })
  it('anchors before the next item at the top', () => {
    expect(anchorFor(['a', 'b'], 0)).toEqual({ before: 'b' })
  })
  it('has no anchor in a single-item list', () => {
    expect(anchorFor(['a'], 0)).toEqual({})
  })
})

describe('crossDropPosition', () => {
  it('follows the previously dropped card when dragging several', async () => {
    const { crossDropPosition } = await import('./ordering')
    expect(crossDropPosition('prev', 'b', 'a', 's')).toEqual({ insert_after: 'prev' })
  })
  it('sits before the card at the drop position', async () => {
    const { crossDropPosition } = await import('./ordering')
    expect(crossDropPosition(null, 'b', 'a', 's')).toEqual({ insert_before: 'b' })
  })
  it('sits after the last card when dropped at the end', async () => {
    const { crossDropPosition } = await import('./ordering')
    expect(crossDropPosition(null, undefined, 'a', 's')).toEqual({ insert_after: 'a' })
  })
  it('names the section for an empty column', async () => {
    const { crossDropPosition } = await import('./ordering')
    expect(crossDropPosition(null, undefined, undefined, 's')).toEqual({ section: 's' })
  })
})
