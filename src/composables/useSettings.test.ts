import { describe, expect, it } from 'vitest'
import { ACCENTS, accentHex, fontAdjust } from './useSettings'

describe('accentHex', () => {
  it('returns the preset colour', () => {
    expect(accentHex('blue', '#000000')).toBe(ACCENTS.blue)
    expect(accentHex('amber', '#000000')).toBe(ACCENTS.amber)
  })
  it('returns a valid custom colour', () => {
    expect(accentHex('custom', '#12abEF')).toBe('#12abEF')
  })
  it('falls back to green for an unknown preset or a malformed custom colour', () => {
    expect(accentHex('nope', '#123456')).toBe(ACCENTS.green)
    expect(accentHex('custom', 'red')).toBe(ACCENTS.green)
    expect(accentHex('custom', '#12')).toBe(ACCENTS.green)
  })
  it('has unique, well-formed presets', () => {
    const values = Object.values(ACCENTS)
    expect(new Set(values).size).toBe(values.length)
    for (const hex of values) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('accentHex with a theme accent', () => {
  it('uses the theme colour when the accent is set to theme', () => {
    expect(accentHex('theme', '#000000', '#cba6f7')).toBe('#cba6f7')
  })
  it('ignores the theme colour for presets and custom colours', () => {
    expect(accentHex('blue', '#000000', '#cba6f7')).toBe(ACCENTS.blue)
    expect(accentHex('custom', '#123456', '#cba6f7')).toBe('#123456')
  })
})

describe('fontAdjust', () => {
  it('keeps Nunito at its natural size by default', () => {
    expect(fontAdjust('normal')).toBe('0.484')
  })
  it('scales the text for the other sizes', () => {
    expect(fontAdjust('small')).toBe('0.445')
    expect(fontAdjust('large')).toBe('0.532')
    expect(fontAdjust('xlarge')).toBe('0.581')
  })
  it('falls back to the default for an unknown size', () => {
    expect(fontAdjust('huge')).toBe('0.484')
  })
})
