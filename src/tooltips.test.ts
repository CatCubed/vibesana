import { describe, expect, it } from 'vitest'
import { claimTitle, placeTooltip } from './tooltips'

const viewport = { width: 1000, height: 800 }

describe('placeTooltip', () => {
  it('centres the tooltip under its target', () => {
    expect(placeTooltip({ left: 400, right: 440, top: 100, bottom: 130 }, 100, 30, viewport)).toEqual({ left: 370, top: 138, above: false })
  })
  it('goes above when there is no room below', () => {
    const place = placeTooltip({ left: 400, right: 440, top: 760, bottom: 790 }, 100, 30, viewport)
    expect(place).toEqual({ left: 370, top: 722, above: true })
  })
  it('stays on screen at the left and right edges', () => {
    expect(placeTooltip({ left: 0, right: 20, top: 100, bottom: 130 }, 200, 30, viewport).left).toBe(6)
    expect(placeTooltip({ left: 980, right: 1000, top: 100, bottom: 130 }, 200, 30, viewport).left).toBe(794)
  })
})

describe('claimTitle', () => {
  it('takes the title over so the browser shows no tooltip of its own', () => {
    const el = document.createElement('button')
    el.title = 'Close'
    expect(claimTitle(el)).toBe('Close')
    expect(el.hasAttribute('title')).toBe(false)
    expect(el.getAttribute('aria-label')).toBe('Close')
    expect(claimTitle(el)).toBe('Close')
  })
  it('does not rename a control that has visible text or its own label', () => {
    const el = document.createElement('button')
    el.textContent = 'Save'
    el.title = 'Save (Ctrl+Enter)'
    claimTitle(el)
    expect(el.hasAttribute('aria-label')).toBe(false)
  })
  it('follows a title that changed or was cleared', () => {
    const el = document.createElement('span')
    el.title = 'One'
    claimTitle(el)
    el.title = 'Two'
    expect(claimTitle(el)).toBe('Two')
    el.setAttribute('title', '')
    expect(claimTitle(el)).toBe('')
  })
})
