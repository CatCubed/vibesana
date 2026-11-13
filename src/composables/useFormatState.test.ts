import { describe, expect, it } from 'vitest'
import { formatsAt } from './useFormatState'

function at(html: string, selector: string) {
  const editor = document.createElement('div')
  editor.innerHTML = html
  const target = editor.querySelector(selector)!
  return formatsAt(editor, target.firstChild ?? target)
}

describe('formatsAt', () => {
  it('reports nothing for plain text', () => {
    const editor = document.createElement('div')
    editor.textContent = 'plain'
    const { block, ...flags } = formatsAt(editor, editor.firstChild)
    expect(Object.values(flags).some(Boolean)).toBe(false)
    expect(block).toBe('p')
  })
  it('detects single formats, including browser tag variants', () => {
    expect(at('<b id="x">a</b>', '#x').bold).toBe(true)
    expect(at('<strong id="x">a</strong>', '#x').bold).toBe(true)
    expect(at('<em id="x">a</em>', '#x').italic).toBe(true)
    expect(at('<u id="x">a</u>', '#x').underline).toBe(true)
    expect(at('<strike id="x">a</strike>', '#x').strike).toBe(true)
    expect(at('<code id="x">a</code>', '#x').code).toBe(true)
    expect(at('<a id="x" href="https://x.test">a</a>', '#x').link).toBe(true)
  })
  it('detects nested formats together', () => {
    const state = at('<ul><li><strong><em id="x">a</em></strong></li></ul>', '#x')
    expect(state).toMatchObject({ bold: true, italic: true, bullets: true, numbers: false })
  })
  it('uses the nearest list for nested lists', () => {
    const state = at('<ul><li>a<ol><li id="x">b</li></ol></li></ul>', '#x')
    expect(state).toMatchObject({ bullets: false, numbers: true })
  })
  it('reports the block style', () => {
    expect(at('<h1 id="x">a</h1>', '#x').block).toBe('h1')
    expect(at('<pre id="x">a</pre>', '#x')).toMatchObject({ block: 'pre', code: true })
  })
  it('ignores formatting outside the editor', () => {
    const outer = document.createElement('strong')
    const editor = document.createElement('div')
    editor.textContent = 'x'
    outer.appendChild(editor)
    expect(formatsAt(editor, editor.firstChild).bold).toBe(false)
  })
})
