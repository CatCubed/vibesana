import { afterEach, describe, expect, it } from 'vitest'
import { autoFormat, revertAutoFormat } from './richshortcuts'
import { serializeRichText } from './richtext'

let editor: HTMLElement

/** Builds an editor from HTML where "|" marks the caret, as if the user had just typed up to there. */
function type(html: string): boolean {
  editor = document.createElement('div')
  editor.innerHTML = html
  document.body.appendChild(editor)
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const at = (node.textContent ?? '').indexOf('|')
    if (at === -1) continue
    node.deleteData(at, 1)
    const range = document.createRange()
    range.setStart(node, at)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return autoFormat(editor, new Event('input'))
  }
  throw new Error('no caret marker')
}

/** Like type(), but each argument becomes its own text node, as browsers leave them after Enter. */
function typeNodes(...texts: string[]): boolean {
  editor = document.createElement('div')
  for (const text of texts) editor.appendChild(document.createTextNode(text))
  document.body.appendChild(editor)
  for (const node of Array.from(editor.childNodes) as Text[]) {
    const at = (node.textContent ?? '').indexOf('|')
    if (at === -1) continue
    node.deleteData(at, 1)
    const range = document.createRange()
    range.setStart(node, at)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return autoFormat(editor, new Event('input'))
  }
  throw new Error('no caret marker')
}

afterEach(() => editor?.remove())

describe('block shortcuts across separate text nodes', () => {
  it('works when the previous text node ends with the line break', () => {
    expect(typeNodes('Existing description.\n', '- |')).toBe(true)
    expect(editor.innerHTML).toBe('Existing description.<ul><li><br></li></ul>')
  })
  it('works with the trailing placeholder newline browsers keep at the end', () => {
    expect(typeNodes('Existing description.\n', '- |\n')).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>Existing description.<ul><li></li></ul></body>')
  })
  it('skips empty text nodes when looking for the line start', () => {
    expect(typeNodes('first\n', '', '- |item')).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>first<ul><li>item</li></ul></body>')
  })
  it('stops at a line break in a following text node', () => {
    typeNodes('- |one', ' more\nnext line')
    expect(serializeRichText(editor)).toBe('<body><ul><li>one more</li></ul>next line</body>')
  })
  it('still refuses a marker in the middle of a line', () => {
    expect(typeNodes('no break here ', '- |')).toBe(false)
  })
})

describe('block shortcuts', () => {
  it('turns "- " on an empty first line into a bullet', () => {
    expect(type('- |')).toBe(true)
    expect(editor.innerHTML).toBe('<ul><li><br></li></ul>')
  })
  it('accepts "* " and a non-breaking space', () => {
    expect(type('* |')).toBe(true)
    expect(editor.querySelector('ul > li')).not.toBeNull()
  })
  it('keeps text already on the line', () => {
    type('- |hello there')
    expect(serializeRichText(editor)).toBe('<body><ul><li>hello there</li></ul></body>')
  })
  it('works on a later line after a line break element', () => {
    type('first<br>- |')
    expect(editor.innerHTML).toBe('first<ul><li><br></li></ul>')
  })
  it('works on a later line inside one text node', () => {
    type('first\n- |second\nthird')
    expect(serializeRichText(editor)).toBe('<body>first<ul><li>second</li></ul>third</body>')
  })
  it('adds to the list right above', () => {
    type('<ul><li>one</li></ul>- |two')
    expect(serializeRichText(editor)).toBe('<body><ul><li>one</li><li>two</li></ul></body>')
  })
  it('makes numbered lists and headings', () => {
    type('1. |a')
    expect(serializeRichText(editor)).toBe('<body><ol><li>a</li></ol></body>')
    editor.remove()
    type('# |Title')
    expect(serializeRichText(editor)).toBe('<body><h1>Title</h1></body>')
    editor.remove()
    type('## |Sub')
    expect(serializeRichText(editor)).toBe('<body><h2>Sub</h2></body>')
  })
  it('works in a line wrapper the browser adds below existing blocks', () => {
    type('<h2>Notes</h2><div>- |</div>')
    expect(editor.innerHTML).toBe('<h2>Notes</h2><ul><li><br></li></ul>')
    editor.remove()
    type('<p>intro</p><div>- |hello<br></div>')
    expect(serializeRichText(editor)).toBe('<body>intro<ul><li>hello</li></ul></body>')
    editor.remove()
    type('<ul><li>one</li></ul><div>- |two</div>')
    expect(serializeRichText(editor)).toBe('<body><ul><li>one</li><li>two</li></ul></body>')
    editor.remove()
    type('<div>first</div><div># |Title</div>')
    expect(serializeRichText(editor)).toBe('<body>first<h1>Title</h1></body>')
  })
  it('ignores markers that are not at the start of a line', () => {
    expect(type('a - |b')).toBe(false)
    expect(type('<strong>x</strong>- |')).toBe(false)
  })
  it('leaves the caret inside the new item', () => {
    type('- |')
    const anchor = window.getSelection()!.anchorNode
    expect(anchor instanceof Element ? anchor.closest('li') : anchor?.parentElement?.closest('li')).not.toBeNull()
  })
})

describe('inline shortcuts', () => {
  it('converts code, bold, strike and italic when the closing mark is typed', () => {
    type('run `npm test`|')
    expect(serializeRichText(editor)).toBe('<body>run <code>npm test</code></body>')
    editor.remove()
    type('**bold**| rest')
    expect(serializeRichText(editor)).toBe('<body><strong>bold</strong> rest</body>')
    editor.remove()
    type('~~old~~|')
    expect(serializeRichText(editor)).toBe('<body><s>old</s></body>')
    editor.remove()
    type('an _emphasised_|')
    expect(serializeRichText(editor)).toBe('<body>an <em>emphasised</em></body>')
  })
  it('does not treat snake_case as italic', () => {
    expect(type('snake_case_name_|')).toBe(false)
  })
  it('does nothing inside code or links', () => {
    expect(type('<code>a `b`|</code>')).toBe(false)
  })
})

describe('formatHotkey', () => {
  const key = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code,
    ...mods,
  })

  it('maps the basic Ctrl shortcuts', async () => {
    const { formatHotkey } = await import('./richshortcuts')
    expect(formatHotkey(key('KeyB'))).toBe('bold')
    expect(formatHotkey(key('KeyI'))).toBe('italic')
    expect(formatHotkey(key('KeyU'))).toBe('underline')
    expect(formatHotkey(key('KeyE'))).toBe('code')
    expect(formatHotkey(key('KeyK'))).toBe('link')
  })
  it('maps the Ctrl+Shift shortcuts', async () => {
    const { formatHotkey } = await import('./richshortcuts')
    expect(formatHotkey(key('KeyX', { shiftKey: true }))).toBe('strikeThrough')
    expect(formatHotkey(key('KeyM', { shiftKey: true }))).toBe('code')
    expect(formatHotkey(key('Digit7', { shiftKey: true }))).toBe('insertOrderedList')
    expect(formatHotkey(key('Digit8', { shiftKey: true }))).toBe('insertUnorderedList')
  })
  it('works with the Mac command key and ignores everything else', async () => {
    const { formatHotkey } = await import('./richshortcuts')
    expect(formatHotkey(key('KeyB', { ctrlKey: false, metaKey: true }))).toBe('bold')
    expect(formatHotkey(key('KeyB', { ctrlKey: false }))).toBeNull()
    expect(formatHotkey(key('KeyB', { altKey: true }))).toBeNull()
    expect(formatHotkey(key('KeyB', { shiftKey: true }))).toBeNull()
    expect(formatHotkey(key('KeyZ'))).toBeNull()
  })
})

describe('code block shortcut and block hotkeys', () => {
  it('turns three backticks and a space into a code block', () => {
    type('``` |')
    expect(editor.innerHTML).toBe('<pre><br></pre>')
  })
  it('maps the block hotkeys', async () => {
    const { formatHotkey } = await import('./richshortcuts')
    const key = (code: string, mods: object) => ({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, code, ...mods })
    expect(formatHotkey(key('Digit0', { altKey: true }))).toBe('block:p')
    expect(formatHotkey(key('Digit1', { altKey: true }))).toBe('block:h1')
    expect(formatHotkey(key('Digit2', { altKey: true }))).toBe('block:h2')
    expect(formatHotkey(key('KeyC', { shiftKey: true }))).toBe('block:pre')
    expect(formatHotkey(key('KeyC', {}))).toBeNull()
    expect(formatHotkey(key('Digit3', { altKey: true }))).toBeNull()
  })
})

describe('quote shortcut', () => {
  it('turns "> " at the start of a line into a quote block', () => {
    type('> |said')
    expect(serializeRichText(editor)).toBe('<body><blockquote>said</blockquote></body>')
  })
})

describe('divider shortcut', () => {
  /** Like type(), with the divider shortcut switched on as it is in the description editor. */
  function typeIn(build: (root: HTMLElement) => void, divider = true): boolean {
    editor = document.createElement('div')
    build(editor)
    document.body.appendChild(editor)
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const at = (node.textContent ?? '').indexOf('|')
      if (at === -1) continue
      node.deleteData(at, 1)
      const range = document.createRange()
      range.setStart(node, at)
      range.collapse(true)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      return autoFormat(editor, new Event('input'), { divider })
    }
    throw new Error('no caret marker')
  }
  const html = (markup: string) => (root: HTMLElement) => (root.innerHTML = markup)
  const nodes = (...texts: string[]) => (root: HTMLElement) => texts.forEach((t) => root.appendChild(document.createTextNode(t)))

  it('turns "---" on an empty editor into a divider and leaves the caret under it', () => {
    expect(typeIn(html('---|'))).toBe(true)
    expect(editor.querySelector('hr')).not.toBeNull()
    expect(serializeRichText(editor)).toBe('<body><hr/></body>')
    const selection = window.getSelection()!
    expect(editor.querySelector('hr')!.compareDocumentPosition(selection.anchorNode!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('puts the divider between the lines around it, without blank lines', () => {
    expect(typeIn(html('above\n---|\nbelow'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>above<hr/>below</body>')
  })
  it('works on the last line', () => {
    expect(typeIn(html('above\n---|'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>above<hr/></body>')
  })
  it('works when Enter left the line in its own text node', () => {
    expect(typeIn(nodes('above\n', '---|'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>above<hr/></body>')
  })
  it('works after a <br> and inside a line wrapper the browser made', () => {
    expect(typeIn(html('above<br>---|'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>above<hr/></body>')
    editor.remove()
    expect(typeIn(html('<div>above</div><div>---|</div>'))).toBe(true)
    expect(editor.querySelectorAll('hr')).toHaveLength(1)
    expect(serializeRichText(editor)).toContain('above')
    expect(serializeRichText(editor)).toContain('<hr/>')
    expect(serializeRichText(editor)).not.toContain('---')
  })
  it('puts a divider above existing text when the dashes are typed in front of it', () => {
    expect(typeIn(html('---|existing text'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><hr/>existing text</body>')
    editor.remove()
    expect(typeIn(html('above\n---|existing\nbelow'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body>above<hr/>existing\nbelow</body>')
    editor.remove()
    expect(typeIn(html('---|<strong>bold start</strong> of a line'))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><hr/><strong>bold start</strong> of a line</body>')
    editor.remove()
    expect(typeIn(html('<div>above</div><div>---|existing</div>'))).toBe(true)
    expect(editor.querySelectorAll('hr')).toHaveLength(1)
    expect(serializeRichText(editor)).toContain('existing')
    expect(serializeRichText(editor)).not.toContain('---')
  })
  it('leaves dashes alone when they are not at the start of a line', () => {
    expect(typeIn(html('a ---|'))).toBe(false)
    editor.remove()
    expect(typeIn(html('--|'))).toBe(false)
    editor.remove()
    expect(typeIn(html('----|'))).toBe(false)
    expect(editor.querySelector('hr')).toBeNull()
  })
  it('is off where dividers are not allowed (comments)', () => {
    expect(typeIn(html('---|'), false)).toBe(false)
    expect(editor.querySelector('hr')).toBeNull()
  })
  it('does not disturb the bullet shortcut', () => {
    expect(typeIn(html('- |'))).toBe(true)
    expect(editor.querySelector('ul li')).not.toBeNull()
  })
})

describe('arrow shortcut', () => {
  it('turns "->" and a space into an arrow and keeps the caret after the space', () => {
    expect(type('api -> |admin')).toBe(true)
    expect(editor.textContent).toBe('api → admin')
    const selection = window.getSelection()!
    expect(selection.anchorOffset).toBe('api → '.length)
  })
  it('works at the start of a line and with a non-breaking space', () => {
    expect(type('-> |')).toBe(true)
    expect(editor.textContent).toBe('→ ')
    editor.remove()
    expect(type('a\n->\u00a0|')).toBe(true)
    expect(editor.textContent).toBe('a\n→\u00a0')
  })
  it('turns "<-" into a left arrow', () => {
    expect(type('back <- |')).toBe(true)
    expect(editor.textContent).toBe('back ← ')
  })
  it('waits for the space', () => {
    expect(type('a ->|')).toBe(false)
    expect(editor.textContent).toBe('a ->')
  })
  it('leaves longer runs and code alone', () => {
    expect(type('a --> |')).toBe(false)
    editor.remove()
    expect(type('<code>x -> |</code>')).toBe(false)
    editor.remove()
    expect(type('<pre>if (a) -> |</pre>')).toBe(false)
    expect(editor.textContent).toBe('if (a) -> ')
  })
  it('does not get in the way of the bullet shortcut', () => {
    expect(type('- |')).toBe(true)
    expect(editor.querySelector('ul li')).not.toBeNull()
  })
})

describe('more replacements', () => {
  it.each([
    ['a <-> |', 'a ↔ '],
    ['x => |', 'x ⇒ '],
    ['wait... |', 'wait… '],
    ['one -- |two', 'one – two'],
  ])('%s', (typed, result) => {
    expect(type(typed)).toBe(true)
    expect(editor.textContent).toBe(result)
  })
  it.each(['a ==> |', 'a <=> |', 'well.... |', '-- |', 'git push --force|', '<pre>a => |</pre>', '<code>a -- |</code>'])(
    'leaves %s alone',
    (typed) => {
      expect(type(typed)).toBe(false)
    },
  )
})

describe('italic with single asterisks', () => {
  it('turns *text* into italic', () => {
    expect(type('an *important*| point')).toBe(true)
    expect(serializeRichText(editor)).toContain('<em>important</em>')
  })
  it('does not fire while bold is being typed, for a bullet, or for multiplication', () => {
    expect(type('**bold*|')).toBe(false)
    editor.remove()
    expect(type('2 * 3 *|')).toBe(false)
    editor.remove()
    expect(type('**bold**|')).toBe(true)
    expect(serializeRichText(editor)).toContain('<strong>bold</strong>')
  })
})

describe('numbered list variants', () => {
  it.each(['1. |first', '1) |first', '3. |third', '12) |twelfth'])('%s starts a numbered list', (typed) => {
    expect(type(typed)).toBe(true)
    expect(editor.querySelector('ol li')).not.toBeNull()
  })
  it('does not treat a year or a decimal as a list', () => {
    expect(type('2026. |')).toBe(false)
    editor.remove()
    expect(type('v1.|')).toBe(false)
  })
})

describe('emoji shortcodes', () => {
  it('replaces :name: when the closing colon is typed', () => {
    expect(type('ship it :rocket:|')).toBe(true)
    expect(editor.textContent).toBe('ship it 🚀')
    editor.remove()
    expect(type(':+1:|')).toBe(true)
    expect(editor.textContent).toBe('👍')
  })
  it('leaves unknown names, times and code alone', () => {
    expect(type('at :nope:|')).toBe(false)
    editor.remove()
    expect(type('10:30:|')).toBe(false)
    editor.remove()
    expect(type('<code>:rocket:|</code>')).toBe(false)
  })
})

describe('Backspace after an automatic conversion', () => {
  const backspace = () => new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true })

  it('gives back the typed characters, with the caret where it was', () => {
    type('api -> |admin')
    expect(editor.textContent).toBe('api → admin')
    const event = backspace()
    expect(revertAutoFormat(editor, event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(editor.textContent).toBe('api -> admin')
    expect(window.getSelection()!.anchorOffset).toBe('api -> '.length)
  })
  it('turns a bullet back into the dash that was typed', () => {
    type('- |item')
    expect(editor.querySelector('ul')).not.toBeNull()
    expect(revertAutoFormat(editor, backspace())).toBe(true)
    expect(editor.querySelector('ul')).toBeNull()
    expect(editor.textContent).toBe('- item')
  })
  it('only works once, and only straight after the conversion', () => {
    type('x => |')
    expect(revertAutoFormat(editor, new KeyboardEvent('keydown', { key: 'a' }))).toBe(false)
    expect(revertAutoFormat(editor, backspace())).toBe(false)
    expect(editor.textContent).toBe('x ⇒ ')
    editor.remove()
    type('x => |')
    expect(revertAutoFormat(editor, backspace())).toBe(true)
    expect(revertAutoFormat(editor, backspace())).toBe(false)
  })
  it('does nothing when the caret has moved away', () => {
    type('x => |tail')
    window.getSelection()!.collapse(editor.firstChild, 0)
    expect(revertAutoFormat(editor, backspace())).toBe(false)
    expect(editor.textContent).toBe('x ⇒ tail')
  })
  it('does nothing when the last input converted nothing', () => {
    type('plain |')
    expect(revertAutoFormat(editor, backspace())).toBe(false)
  })
})
