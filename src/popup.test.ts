import { describe, expect, it } from 'vitest'
import { chooseSide } from './popup'

const bounds = { left: 0, right: 1000 }

describe('chooseSide', () => {
  it('keeps the preferred side when the popup fits there', () => {
    expect(chooseSide({ left: 500, right: 600 }, bounds, 400, 'right')).toBe('right')
    expect(chooseSide({ left: 500, right: 600 }, bounds, 400, 'left')).toBe('left')
  })
  it('flips when the preferred side would be cut off', () => {
    expect(chooseSide({ left: 20, right: 120 }, bounds, 400, 'right')).toBe('left')
    expect(chooseSide({ left: 880, right: 980 }, bounds, 400, 'left')).toBe('right')
  })
  it('respects bounds that do not start at zero (a panel on the right of the screen)', () => {
    expect(chooseSide({ left: 620, right: 720 }, { left: 600, right: 1200 }, 400, 'right')).toBe('left')
  })
  it('picks the roomier side when the popup fits on neither', () => {
    expect(chooseSide({ left: 100, right: 200 }, { left: 0, right: 420 }, 400, 'right')).toBe('left')
    expect(chooseSide({ left: 250, right: 350 }, { left: 0, right: 420 }, 400, 'left')).toBe('right')
  })
})
