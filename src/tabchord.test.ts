import { describe, expect, it } from 'vitest'
import { chordKey, createChordTracker } from './tabchord'

describe('createChordTracker', () => {
  it('completes a chord while Tab is held, repeatedly', () => {
    const chord = createChordTracker()
    chord.tabDown(0)
    expect(chord.take(5000)).toBe(true)
    expect(chord.take(9000)).toBe(true)
    expect(chord.tabUp()).toBe(false)
  })
  it('completes one chord shortly after a Tab tap', () => {
    const chord = createChordTracker()
    chord.tabDown(0)
    expect(chord.tabUp()).toBe(true)
    expect(chord.take(800)).toBe(true)
    expect(chord.take(900)).toBe(false)
  })
  it('lets the Tab expire', () => {
    const chord = createChordTracker()
    chord.tabDown(0)
    chord.tabUp()
    expect(chord.take(1500)).toBe(false)
  })
  it('does nothing without a Tab', () => {
    expect(createChordTracker().take(10)).toBe(false)
  })
  it('can be disarmed', () => {
    const chord = createChordTracker()
    chord.tabDown(0)
    chord.tabUp()
    chord.disarm()
    expect(chord.take(100)).toBe(false)
  })
})

describe('chordKey', () => {
  const key = (init: KeyboardEventInit) => chordKey(new KeyboardEvent('keydown', init))
  it('names letters in lower case and Backspace/Delete alike', () => {
    expect(key({ key: 'M' })).toBe('m')
    expect(key({ key: 'Backspace' })).toBe('backspace')
    expect(key({ key: 'Delete' })).toBe('backspace')
  })
  it('ignores other keys and modified keys', () => {
    expect(key({ key: 'Enter' })).toBeNull()
    expect(key({ key: '1' })).toBeNull()
    expect(key({ key: 'm', ctrlKey: true })).toBeNull()
    expect(key({ key: 'm', altKey: true })).toBeNull()
  })
})
