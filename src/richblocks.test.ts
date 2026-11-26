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

describe('block styles over several selected lines', () => {
  /** Builds an editor from HTML where "[" and "]" mark the selection, then applies the style. */
  function select(html: string, kind: BlockKind): string {
    editor = document.createElement('div')
    editor.innerHTML = html
    document.body.appendChild(editor)
    const range = document.createRange()
    const find = (mark: string): [Text, number] => {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const at = node.data.indexOf(mark)
        if (at === -1) continue
        node.deleteData(at, 1)
        return [node, at]
      }
      throw new Error(`no ${mark} marker`)
    }
    range.setStart(...find('['))
    range.setEnd(...find(']'))
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    setBlock(editor, kind)
    return serializeRichText(editor)
  }

  it('quotes every selected line as one quote block (newline characters)', () => {
    expect(select('before\n[one\ntwo\nthr]ee\nafter', 'blockquote')).toBe(
      '<body>before<blockquote>one\ntwo\nthree</blockquote>after</body>',
    )
  })
  it('quotes every selected line as one quote block (line break elements)', () => {
    expect(select('o[ne<br>two<br>three]<br>after', 'blockquote')).toBe('<body><blockquote>one\ntwo\nthree</blockquote>after</body>')
  })
  it('works across the line wrappers a browser creates', () => {
    const xml = select('<div>[one</div><div>two</div><div>thr]ee</div><div>after</div>', 'blockquote')
    expect(xml).toContain('<blockquote>one\ntwo\nthree</blockquote>')
    expect(xml).toContain('after')
    expect(editor.querySelectorAll('blockquote')).toHaveLength(1)
  })
  it('makes one code block out of several lines and keeps a blank line inside it', () => {
    expect(select('[a = 1\n\nb = 2]', 'pre')).toBe('<body><pre>a = 1\n\nb = 2</pre></body>')
  })
  it('gives every selected line its own heading and leaves blank lines blank', () => {
    const xml = select('[First\n\nSecond]\nrest', 'h2')
    expect(editor.querySelectorAll('h2')).toHaveLength(2)
    expect(xml).toContain('<h2>First</h2>')
    expect(xml).toContain('<h2>Second</h2>')
    expect(xml).toContain('rest')
    expect(xml).not.toContain('<h2></h2>')
  })
  it('does not take the next line when the selection ends at its very start', () => {
    expect(select('[one\ntwo\n]three', 'blockquote')).toBe('<body><blockquote>one\ntwo</blockquote>three</body>')
  })
  it('keeps inline formatting and joins a line that is already a quote', () => {
    const xml = select('[plain <strong>bold</strong><blockquote>old</blockquote>la]st', 'blockquote')
    expect(editor.querySelectorAll('blockquote')).toHaveLength(1)
    expect(xml).toBe('<body><blockquote>plain <strong>bold</strong>\nold\nlast</blockquote></body>')
  })
  it('turns every selected block back into normal text', () => {
    const xml = select('<h1>[Title</h1><blockquote>quoted</blockquote>pla]in', 'p')
    expect(editor.querySelector('h1, blockquote')).toBeNull()
    expect(xml).toContain('Title')
    expect(xml).toContain('quoted')
  })
  it('skips list items inside the selection', () => {
    select('[one<ul><li>item</li></ul>tw]o', 'blockquote')
    expect(editor.querySelector('li')?.textContent).toBe('item')
    expect(editor.querySelectorAll('blockquote')).toHaveLength(2)
  })
  it('still treats a selection inside one line as that single line', () => {
    expect(select('one\nt[w]o\nthree', 'blockquote')).toBe('<body>one<blockquote>two</blockquote>three</body>')
  })
})

describe('insertDivider', () => {
  async function divide(html: string): Promise<string> {
    const { insertDivider } = await import('./richblocks')
    setup(html)
    expect(insertDivider(editor)).toBe(true)
    return serializeRichText(editor)
  }
  it('goes under the line the caret is in (newline characters)', async () => {
    expect(await divide('one\ntw|o\nthree')).toBe('<body>one\ntwo<hr/>three</body>')
  })
  it('goes under the line the caret is in (line break elements)', async () => {
    expect(await divide('on|e<br>two')).toBe('<body>one<hr/>two</body>')
  })
  it('goes at the end when the caret is on the last line, with a place to keep typing', async () => {
    expect(await divide('only li|ne')).toBe('<body>only line<hr/></body>')
    expect(editor.lastChild?.nodeType).toBe(Node.TEXT_NODE)
    expect(window.getSelection()!.anchorNode).toBe(editor.lastChild)
  })
  it('keeps inline formatting on the line together', async () => {
    expect(await divide('pl|ain <strong>bold</strong> end\nnext')).toBe('<body>plain <strong>bold</strong> end<hr/>next</body>')
  })
  it('goes after a whole list, heading or quote rather than inside it', async () => {
    expect(await divide('<ul><li>a</li><li>b|</li></ul>after')).toBe('<body><ul><li>a</li><li>b</li></ul><hr/>after</body>')
    editor.remove()
    expect(await divide('<blockquote>quo|ted</blockquote>')).toBe('<body><blockquote>quoted</blockquote><hr/></body>')
  })
})
