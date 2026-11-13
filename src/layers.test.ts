import { describe, expect, it, vi } from 'vitest'
import { closeTopLayer, onLayerKey, pushLayer } from './layers'

describe('layers', () => {
  it('closes only the innermost layer', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    const removeOuter = pushLayer(outer)
    const removeInner = pushLayer(inner)
    expect(closeTopLayer()).toBe(true)
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
    removeInner()
    expect(closeTopLayer()).toBe(true)
    expect(outer).toHaveBeenCalledOnce()
    removeOuter()
  })
  it('reports when nothing is open', () => {
    expect(closeTopLayer()).toBe(false)
  })
  it('swallows Escape while a layer is open and lets it through otherwise', () => {
    const remove = pushLayer(() => {})
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    onLayerKey(handled)
    expect(handled.defaultPrevented).toBe(true)
    remove()
    const free = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    onLayerKey(free)
    expect(free.defaultPrevented).toBe(false)
  })
  it('ignores other keys', () => {
    const close = vi.fn()
    const remove = pushLayer(close)
    onLayerKey(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(close).not.toHaveBeenCalled()
    remove()
  })
})
