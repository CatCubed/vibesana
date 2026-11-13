import { describe, expect, it } from 'vitest'
import { focusableIn, trapTarget } from './useFocusTrap'

function build(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('trapTarget', () => {
  const root = build('<button id="a">A</button><input id="b" /><button id="c" disabled>C</button><a id="d" href="#">D</a>')
  const [a, b, d] = ['a', 'b', 'd'].map((id) => root.querySelector<HTMLElement>(`#${id}`)!)

  it('skips disabled controls', () => {
    expect(focusableIn(root)).toEqual([a, b, d])
  })
  it('wraps from the last control to the first and back', () => {
    expect(trapTarget(root, d, false)).toBe(a)
    expect(trapTarget(root, a, true)).toBe(d)
  })
  it('leaves Tab alone in the middle', () => {
    expect(trapTarget(root, b, false)).toBeNull()
    expect(trapTarget(root, b, true)).toBeNull()
  })
  it('pulls focus in when it is outside', () => {
    expect(trapTarget(root, document.body, false)).toBe(a)
    expect(trapTarget(root, null, true)).toBe(d)
  })
  it('keeps focus on a container with nothing focusable', () => {
    const empty = build('<p>text</p>')
    expect(trapTarget(empty, null, false)).toBe(empty)
  })
})
