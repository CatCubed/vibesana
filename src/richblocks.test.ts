import { afterEach, describe, expect, it } from 'vitest'
import { blockAt, exitCodeOnEnter, setBlock, type BlockKind } from './richblocks'
import { serializeRichText } from './richtext'

let editor: HTMLElement

/** Builds an editor from HTML where "|" marks the caret. */
function setup(html: string): void {
  editor = document.createElement('div')
  editor.innerHTML = html
  document.body.appendChild(editor)
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const at = node.data.indexOf('|')
    if (at === -1) continue
    node.deleteData(at, 1)
    const range = document.createRange()
    range.setStart(node, at)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }
  throw new Error('no caret marker')
}

function apply(html: string, kind: BlockKind): string {
  setup(html)
  setBlock(editor, kind)
  return serializeRichText(editor)
}

afterEach(() => editor?.remove())

describe('setBlock', () => {
  it('turns a single line into a heading or code block', () => {
    expect(apply('Tit|le', 'h1')).toBe('<body><h1>Title</h1></body>')
    editor.remove()
    expect(apply('Tit|le', 'h2')).toBe('<body><h2>Title</h2></body>')
    editor.remove()
    expect(apply('npm t|est', 'pre')).toBe('<body><pre>npm test</pre></body>')
  })
  it('only takes the line the caret is on (line break elements)', () => {
    expect(apply('one<br>tw|o<br>three', 'h1')).toBe('<body>one<h1>two</h1>three</body>')
  })
  it('only takes the line the caret is on (newlines in one text node)', () => {
    expect(apply('one\ntw|o\nthree', 'h2')).toBe('<body>one<h2>two</h2>three</body>')
  })
  it('keeps inline formatting on the line', () => {
    expect(apply('a <strong>bo|ld</strong> title<br>next', 'h1')).toBe('<body><h1>a <strong>bold</strong> title</h1>next</body>')
  })
  it('works inside a line wrapper', () => {
    expect(apply('<div>first</div><div>sec|ond</div>', 'h1')).toBe('<body>first<h1>second</h1></body>')
  })
  it('switches between block kinds', () => {
    expect(apply('<h1>Ti|tle</h1>', 'h2')).toBe('<body><h2>Title</h2></body>')
    editor.remove()
    expect(apply('<h2>co|de</h2>', 'pre')).toBe('<body><pre>code</pre></body>')
  })
  it('toggles off when the same kind is applied again, and with normal text', () => {
    expect(apply('<h1>Ti|tle</h1>', 'h1')).toBe('<body>Title</body>')
    editor.remove()
    expect(apply('<pre>co|de</pre>', 'p')).toBe('<body>code</body>')
  })
  it('keeps neighbouring text on its own lines when turning a heading back into text', () => {
    expect(apply('before<h1>Ti|tle</h1>after', 'p')).toBe('<body>before\nTitle\nafter</body>')
  })
  it('does nothing for normal text set to normal, or inside a list item', () => {
    setup('pla|in')
    expect(setBlock(editor, 'p')).toBe(false)
    editor.remove()
    setup('<ul><li>it|em</li></ul>')
    expect(setBlock(editor, 'h1')).toBe(false)
  })
})

describe('blockAt', () => {
  it('reports the block style at a node', () => {
    setup('<h2>a|</h2><pre>b</pre>plain')
    expect(blockAt(editor, editor.querySelector('h2')!.firstChild)).toBe('h2')
    expect(blockAt(editor, editor.querySelector('pre')!.firstChild)).toBe('pre')
    expect(blockAt(editor, editor.lastChild)).toBe('p')
  })
})

describe('exitCodeOnEnter', () => {
  const enter = () => new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })

  it('stays in the block after the first Enter', () => {
    setup('<pre>code|</pre>')
    expect(exitCodeOnEnter(editor, enter())).toBe(false)
  })
  it('leaves the block from an empty last line (line break elements)', () => {
    setup('<pre>code<br>|<br></pre>')
    editor.querySelector('pre')!.lastChild!.previousSibling!.textContent = ''
    const pre = editor.querySelector('pre')!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(pre, pre.childNodes.length)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    expect(exitCodeOnEnter(editor, enter())).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><pre>code</pre></body>')
  })
  it('leaves the block from an empty last line (newline characters)', () => {
    setup('<pre>code\n\n|</pre>')
    expect(exitCodeOnEnter(editor, enter())).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><pre>code</pre></body>')
  })
  it('does nothing in the middle of the block', () => {
    setup('<pre>co|de\n\n</pre>')
    expect(exitCodeOnEnter(editor, enter())).toBe(false)
  })
})

describe('quote blocks', () => {
  it('turns a line into a quote and back', () => {
    expect(apply('quo|ted<br>next', 'blockquote')).toBe('<body><blockquote>quoted</blockquote>next</body>')
    editor.remove()
    expect(apply('<blockquote>quo|ted</blockquote>', 'blockquote')).toBe('<body>quoted</body>')
  })
  it('leaves the quote from an empty last line', () => {
    setup('<blockquote>quoted\n\n|</blockquote>')
    expect(exitCodeOnEnter(editor, new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))).toBe(true)
    expect(serializeRichText(editor)).toBe('<body><blockquote>quoted</blockquote></body>')
  })
})
