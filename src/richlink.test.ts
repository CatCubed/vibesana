import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './richlink'

describe('normalizeUrl', () => {
  it.each([
    ['https://asana.com/x', 'https://asana.com/x'],
    ['http://example.com', 'http://example.com'],
    ['  example.com/page ', 'https://example.com/page'],
    ['localhost:5199/board', 'https://localhost:5199/board'],
    ['mailto:a@b.cz', 'mailto:a@b.cz'],
    ['jan.novak@example.com', 'mailto:jan.novak@example.com'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })
  it.each(['', '   ', 'javascript:alert(1)', 'file:///etc/passwd', 'two words', 'data:text/html,x'])('rejects %j', (input) => {
    expect(normalizeUrl(input)).toBeNull()
  })
})

describe('linkSelectionTo', () => {
  function select(html: string, from: number, to: number): HTMLElement {
    const editor = document.createElement('div')
    editor.innerHTML = html
    document.body.appendChild(editor)
    const text = editor.firstChild as Text
    const range = document.createRange()
    range.setStart(text, from)
    range.setEnd(text, to)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return editor
  }
  it('links the selected text to a pasted address', async () => {
    const { linkSelectionTo } = await import('./richlink')
    const editor = select('see the docs here', 8, 12)
    expect(linkSelectionTo(editor, ' https://example.com/docs \n')).toBe(true)
    const link = editor.querySelector('a')!
    expect(link.textContent).toBe('docs')
    expect(link.getAttribute('href')).toBe('https://example.com/docs')
    expect(editor.textContent).toBe('see the docs here')
    editor.remove()
  })
  it('leaves the paste alone when it is not a single web address, or nothing is selected', async () => {
    const { linkSelectionTo } = await import('./richlink')
    const editor = select('see the docs here', 8, 12)
    expect(linkSelectionTo(editor, 'just words')).toBe(false)
    expect(linkSelectionTo(editor, 'https://a.example https://b.example')).toBe(false)
    expect(linkSelectionTo(editor, 'javascript:alert(1)')).toBe(false)
    window.getSelection()!.collapseToStart()
    expect(linkSelectionTo(editor, 'https://example.com')).toBe(false)
    expect(editor.querySelector('a')).toBeNull()
    editor.remove()
  })
  it('does not link inside code or an existing link', async () => {
    const { linkSelectionTo } = await import('./richlink')
    const editor = document.createElement('div')
    editor.innerHTML = '<code>some code</code>'
    document.body.appendChild(editor)
    const text = editor.querySelector('code')!.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 4)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    expect(linkSelectionTo(editor, 'https://example.com')).toBe(false)
    editor.remove()
  })
})
