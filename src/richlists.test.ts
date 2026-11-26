import { afterEach, describe, expect, it } from 'vitest'
import { handleListTab, indentListItem, outdentListItem } from './richlists'
import { serializeRichText } from './richtext'

let editor: HTMLElement
function build(html: string): HTMLElement {
  editor = document.createElement('div')
  editor.innerHTML = html
  document.body.appendChild(editor)
  return editor
}
const item = (text: string) => [...editor.querySelectorAll('li')].find((li) => li.firstChild?.textContent === text) as HTMLLIElement
afterEach(() => editor?.remove())

describe('indentListItem', () => {
  it('nests an item under the one above it', () => {
    build('<ul><li>a</li><li>b</li><li>c</li></ul>')
    expect(indentListItem(item('b'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><ul><li>a<ul><li>b</li></ul></li><li>c</li></ul></body>')
  })
  it('joins a nested list that is already there, and keeps the list kind', () => {
    build('<ol><li>a<ol><li>x</li></ol></li><li>b</li></ol>')
    expect(indentListItem(item('b'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><ol><li>a<ol><li>x</li><li>b</li></ol></li></ol></body>')
  })
  it('does nothing for the first item', () => {
    build('<ul><li>a</li><li>b</li></ul>')
    expect(indentListItem(item('a'))).toBe(false)
  })
})

describe('outdentListItem', () => {
  it('moves a nested item back up, after its parent', () => {
    build('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>')
    expect(outdentListItem(item('b'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><ul><li>a</li><li>b</li><li>c</li></ul></body>')
  })
  it('keeps the items that followed it underneath it', () => {
    build('<ul><li>a<ul><li>b</li><li>c</li><li>d</li></ul></li></ul>')
    expect(outdentListItem(item('b'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><ul><li>a</li><li>b<ul><li>c</li><li>d</li></ul></li></ul></body>')
  })
  it('does nothing at the top level', () => {
    build('<ul><li>a</li></ul>')
    expect(outdentListItem(item('a'))).toBe(false)
  })
})

describe('handleListTab', () => {
  const tab = (shiftKey = false) => new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })
  const caretIn = (li: HTMLLIElement) => window.getSelection()!.collapse(li.firstChild, 1)

  it('indents with Tab and outdents with Shift+Tab, keeping the caret in the item', () => {
    build('<ul><li>a</li><li>bb</li></ul>')
    caretIn(item('bb'))
    const down = tab()
    expect(handleListTab(editor, down)).toBe(true)
    expect(down.defaultPrevented).toBe(true)
    expect(editor.querySelector('ul ul li')?.textContent).toBe('bb')
    expect(window.getSelection()!.anchorNode?.textContent).toBe('bb')
    expect(handleListTab(editor, tab(true))).toBe(true)
    expect(editor.querySelector('ul ul')).toBeNull()
  })
  it('swallows Tab on an item that cannot move, so focus does not jump out of the editor', () => {
    build('<ul><li>a</li></ul>')
    caretIn(item('a'))
    const event = tab()
    expect(handleListTab(editor, event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })
  it('leaves Tab alone outside a list', () => {
    build('plain text')
    window.getSelection()!.collapse(editor.firstChild, 2)
    expect(handleListTab(editor, tab())).toBe(false)
  })
})
