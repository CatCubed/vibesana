export type BlockKind = 'p' | 'h1' | 'h2' | 'pre' | 'blockquote'

const BOUNDARY = new Set(['BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'H1', 'H2', 'BLOCKQUOTE', 'PRE', 'HR'])
const ELEMENT_BLOCKS = new Set(['DIV', 'P', 'UL', 'OL', 'H1', 'H2', 'BLOCKQUOTE', 'PRE', 'HR'])
const ZWSP = '​'

function isBoundary(node: Node | null): boolean {
  return !node || BOUNDARY.has(node.nodeName)
}

function caretAtEnd(element: Node): void {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function caretAt(node: Node, offset: number): void {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function convertExisting(block: Element, target: BlockKind): boolean {
  const nodes = Array.from(block.childNodes)
  if (target === 'p') {
    const pieces: Node[] = [...nodes]
    const prev = block.previousSibling
    const next = block.nextSibling
    if (prev && !ELEMENT_BLOCKS.has(prev.nodeName) && prev.nodeName !== 'BR' && !(prev.textContent ?? '').endsWith('\n')) {
      pieces.unshift(document.createElement('br'))
    }
    if (next && !ELEMENT_BLOCKS.has(next.nodeName)) pieces.push(document.createElement('br'))
    block.replaceWith(...pieces)
    const last = nodes[nodes.length - 1]
    if (last) {
      if (last.nodeName === 'BR') caretAt(last.parentNode!, Array.from(last.parentNode!.childNodes).indexOf(last as ChildNode))
      else caretAtEnd(last)
    }
    return true
  }
  const element = document.createElement(target)
  element.append(...nodes)
  block.replaceWith(element)
  caretAtEnd(element)
  return true
}

function wrapLine(editor: HTMLElement, node: Node, offset: number, kind: Exclude<BlockKind, 'p'>): boolean {
  let container: HTMLElement = editor
  let base: Node = node
  while (base.parentNode && base.parentNode !== editor) {
    const parent = base.parentNode as HTMLElement
    if (parent.parentNode === editor && (parent.tagName === 'DIV' || parent.tagName === 'P')) {
      container = parent
      break
    }
    base = parent
  }
  if (base.parentNode !== container) return false

  let beforeDone = false
  let afterDone = false
  if (base.nodeType === Node.TEXT_NODE && base === node) {
    const text = base as Text
    const endBreak = text.data.indexOf('\n', offset)
    if (endBreak !== -1) {
      text.splitText(endBreak).deleteData(0, 1)
      afterDone = true
    }
    const startBreak = offset > 0 ? text.data.lastIndexOf('\n', offset - 1) : -1
    if (startBreak !== -1) {
      const line = text.splitText(startBreak + 1)
      text.deleteData(startBreak, 1)
      base = line
      beforeDone = true
    }
  }

  const nodes: Node[] = [base]
  if (!beforeDone) {
    let prev = base.previousSibling
    while (prev && !isBoundary(prev)) {
      if (prev.nodeType === Node.TEXT_NODE) {
        const text = prev as Text
        const at = text.data.lastIndexOf('\n')
        if (at === text.data.length - 1 && at !== -1) {
          text.deleteData(at, 1)
          prev = null
          break
        }
        if (at !== -1) {
          const tail = text.splitText(at + 1)
          text.deleteData(at, 1)
          nodes.unshift(tail)
          prev = null
          break
        }
      }
      nodes.unshift(prev)
      prev = prev.previousSibling
    }
    if (prev?.nodeName === 'BR') prev.parentNode?.removeChild(prev)
  }
  if (!afterDone) {
    let next = nodes[nodes.length - 1].nextSibling
    while (next && !isBoundary(next)) {
      if (next.nodeType === Node.TEXT_NODE) {
        const text = next as Text
        const at = text.data.indexOf('\n')
        if (at === 0) {
          text.deleteData(0, 1)
          next = null
          break
        }
        if (at > 0) {
          text.splitText(at).deleteData(0, 1)
          nodes.push(text)
          next = null
          break
        }
      }
      nodes.push(next)
      next = next.nextSibling
    }
    if (next?.nodeName === 'BR') next.parentNode?.removeChild(next)
  }

  const element = document.createElement(kind)
  container.insertBefore(element, nodes[0])
  for (const item of nodes) element.appendChild(item)
  if (container !== editor && container.childNodes.length === 1) container.replaceWith(element)
  if (!element.textContent && !element.querySelector('img')) {
    element.textContent = ''
    element.appendChild(document.createElement('br'))
    caretAt(element, 0)
  } else {
    caretAtEnd(element)
  }
  return true
}

interface Position {
  node: Node
  offset: number
}

/** The node a position points at, stepping into the editor itself and into the line wrappers browsers create. */
function resolve(editor: HTMLElement, node: Node, offset: number): Position {
  let at: Position = { node, offset }
  for (;;) {
    const el = at.node
    const wrapper = el === editor || (el instanceof HTMLElement && el.parentNode === editor && (el.tagName === 'DIV' || el.tagName === 'P'))
    if (!wrapper) return at
    const child = el.childNodes[at.offset] ?? el.lastChild
    if (!child) {
      if (el !== editor) return at
      return { node: editor.appendChild(document.createTextNode('')), offset: 0 }
    }
    at = { node: child, offset: 0 }
  }
}

/** The block the caret ended up in after a change. */
function blockAtCaret(editor: HTMLElement, kind: BlockKind): Element | null {
  const anchor = window.getSelection()?.anchorNode ?? null
  const element = anchor instanceof Element ? anchor : (anchor?.parentElement ?? null)
  const block = element?.closest(kind) ?? null
  return block && block !== editor && editor.contains(block) ? block : null
}

/**
 * Applies a block style to the line at `at`. With `toggle`, applying the style a line already has turns it
 * back into normal text. Returns the block the line is in afterwards, or null (normal text, or a list item).
 */
function applyToLine(editor: HTMLElement, at: Position, kind: BlockKind, toggle: boolean): Element | null {
  const element = at.node instanceof Element ? at.node : at.node.parentElement
  const item = element?.closest('li, ul, ol')
  if ((item && item !== editor && editor.contains(item)) || at.node.nodeName === 'HR') return null
  const existing = element?.closest('h1, h2, pre, blockquote')
  if (existing && existing !== editor && editor.contains(existing)) {
    const same = existing.tagName.toLowerCase() === kind
    if (same && !toggle) return existing
    convertExisting(existing, same ? 'p' : kind)
    return same || kind === 'p' ? null : blockAtCaret(editor, kind)
  }
  if (kind === 'p') return null
  return wrapLine(editor, at.node, at.offset, kind) ? blockAtCaret(editor, kind) : null
}

function spansLines(range: Range): boolean {
  if (range.collapsed) return false
  return range.toString().includes('\n') || range.cloneContents().querySelector('br, div, p, h1, h2, pre, blockquote, li, hr') !== null
}

function isBlank(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').split(ZWSP).join('')
}

/** A selection over several lines: every line gets the style. Quotes and code become one block, headings one per line. */
function setBlockOnLines(editor: HTMLElement, range: Range, kind: Exclude<BlockKind, 'p'>): boolean {
  const start = { node: range.startContainer, offset: range.startOffset }
  // Marks where the selection ends, and survives the text nodes being split and moved around it.
  const marker = document.createElement('span')
  const end = range.cloneRange()
  end.collapse(false)
  end.insertNode(marker)

  const made: Element[] = []
  let at = resolve(editor, start.node, start.offset)
  for (let guard = 0; guard < 500; guard++) {
    const block = applyToLine(editor, at, kind, false)
    let next: Node | null
    if (block) {
      made.push(block)
      if (block.contains(marker)) break
      next = block.nextSibling
    } else {
      const element = at.node instanceof Element ? at.node : at.node.parentElement
      const list = element?.closest('ul, ol')
      if (!list || list.contains(marker)) break
      next = list.nextSibling
    }
    // Lists and dividers keep their own shape: step over them.
    for (;;) {
      while (next && isBlank(next)) next = next.nextSibling
      if (!next || !['UL', 'OL', 'HR'].includes(next.nodeName)) break
      next = next.contains(marker) ? null : next.nextSibling
    }
    // Nothing left, or the selection ended right at the start of the next line.
    if (!next || next === marker) break
    at = resolve(editor, next, 0)
  }
  marker.remove()

  const heading = kind === 'h1' || kind === 'h2'
  let last: Element | null = null
  for (const block of made) {
    if (!block.isConnected) continue
    const empty = !(block.textContent ?? '').split(ZWSP).join('') && !block.querySelector('img')
    if (heading) {
      // An empty line inside the selection stays an empty line, not an empty heading.
      if (empty) block.replaceWith(document.createElement('br'))
      else last = block
      continue
    }
    let previous = block.previousSibling
    while (previous && isBlank(previous)) previous = previous.previousSibling
    if (last && previous === last) {
      // Same quote or code block: the line joins the one above it.
      if (!(last.textContent ?? '').split(ZWSP).join('')) last.querySelector('br')?.remove()
      last.append('\n', ...(empty ? [] : Array.from(block.childNodes)))
      block.remove()
    } else {
      last = block
    }
  }
  if (last) caretAtEnd(last)
  return made.length > 0
}

/**
 * Turns the line at the caret into a heading, quote or code block, or back into normal text; pressing the
 * same kind again toggles it off. With several lines selected, all of them get the style.
 */
export function setBlock(editor: HTMLElement, kind: BlockKind): boolean {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return false
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return false
  if (spansLines(range) && editor.contains(range.endContainer)) {
    if (kind !== 'p') return setBlockOnLines(editor, range, kind)
    const blocks = Array.from(editor.querySelectorAll('h1, h2, pre, blockquote')).filter((block) => range.intersectsNode(block))
    for (const block of blocks) convertExisting(block, 'p')
    return blocks.length > 0
  }
  const before = editor.innerHTML
  applyToLine(editor, resolve(editor, range.startContainer, range.startOffset), kind, true)
  return editor.innerHTML !== before
}

/**
 * Puts a divider line under the line (or block) the caret is in, and the caret on the line below it.
 * Inside a list, heading, quote or code block the divider goes after that whole block.
 */
export function insertDivider(editor: HTMLElement): boolean {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return false
  const range = selection.getRangeAt(0)
  let node: Node = range.endContainer
  let offset = range.endOffset
  if (node === editor) {
    node = editor.childNodes[offset - 1] ?? editor.childNodes[offset] ?? editor.appendChild(document.createTextNode(''))
    offset = node.nodeType === Node.TEXT_NODE ? (node as Text).length : 0
  }
  let top = node
  while (top.parentNode && top.parentNode !== editor) top = top.parentNode
  const rule = document.createElement('hr')

  const text = top === node && node.nodeType === Node.TEXT_NODE ? (node as Text) : null
  const breakAt = text ? text.data.indexOf('\n', offset) : -1
  if (text && breakAt !== -1) {
    // The line ends inside this text node: the divider goes where its line break was.
    const tail = text.splitText(breakAt)
    tail.deleteData(0, 1)
    editor.insertBefore(rule, tail)
  } else {
    // Walk to the end of the line: up to a line break, a block, or the end of the editor.
    let last = top
    let next = top.nextSibling
    if (!ELEMENT_BLOCKS.has(top.nodeName)) {
      while (next && !isBoundary(next) && !(next.nodeType === Node.TEXT_NODE && (next.textContent ?? '').includes('\n'))) {
        last = next
        next = next.nextSibling
      }
    }
    if (!ELEMENT_BLOCKS.has(top.nodeName) && next?.nodeName === 'BR') {
      next.parentNode?.replaceChild(rule, next)
    } else if (!ELEMENT_BLOCKS.has(top.nodeName) && next?.nodeType === Node.TEXT_NODE) {
      const following = next as Text
      const at = following.data.indexOf('\n')
      const tail = at > 0 ? following.splitText(at) : following
      tail.deleteData(0, 1)
      editor.insertBefore(rule, tail)
    } else {
      editor.insertBefore(rule, last.nextSibling)
    }
  }

  let below = rule.nextSibling
  if (!below || below.nodeType !== Node.TEXT_NODE) {
    below = document.createTextNode(ZWSP)
    rule.after(below)
    caretAt(below, 1)
  } else {
    if (!(below as Text).length) (below as Text).data = ZWSP
    caretAt(below, (below as Text).data.startsWith(ZWSP) ? 1 : 0)
  }
  return true
}

/** The block style at `node`: a heading, a code block, or normal text. */
export function blockAt(editor: HTMLElement, node: Node | null): BlockKind {
  const element = node instanceof Element ? node : (node?.parentElement ?? null)
  const block = element?.closest('h1, h2, pre, blockquote')
  if (!block || block === editor || !editor.contains(block)) return 'p'
  return block.tagName.toLowerCase() as BlockKind
}

/** Enter on an empty last line of a code or quote block leaves the block. Returns true when handled. */
export function exitCodeOnEnter(editor: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey) return false
  const selection = window.getSelection()
  if (!selection?.rangeCount || !selection.isCollapsed) return false
  const anchor = selection.anchorNode
  const element = anchor instanceof Element ? anchor : anchor?.parentElement
  const pre = element?.closest('pre, blockquote')
  if (!pre || !editor.contains(pre) || !pre.lastChild) return false

  const rest = document.createRange()
  rest.setStart(selection.anchorNode!, selection.anchorOffset)
  rest.setEndAfter(pre.lastChild)
  if (rest.toString().replace(/\n/g, '') !== '') return false

  // Count the line breaks at the very end: two or more means the caret is on an empty last line.
  const trailing: { node: Node; isText: boolean }[] = []
  let cursor: Node | null = pre.lastChild
  while (cursor && trailing.length < 2) {
    if (cursor.nodeName === 'BR') {
      trailing.push({ node: cursor, isText: false })
      cursor = cursor.previousSibling
    } else if (cursor.nodeType === Node.TEXT_NODE) {
      const data = (cursor as Text).data
      if (data === '') {
        cursor = cursor.previousSibling
      } else if (data.endsWith('\n')) {
        trailing.push({ node: cursor, isText: true })
        if (data.endsWith('\n\n') && trailing.length < 2) trailing.push({ node: cursor, isText: true })
        if (!/^\n+$/.test(data)) break
        cursor = cursor.previousSibling
      } else {
        break
      }
    } else {
      break
    }
  }
  if (trailing.length < 2) return false

  event.preventDefault()
  for (const { node, isText } of trailing) {
    if (isText) (node as Text).deleteData((node as Text).data.length - 1, 1)
    else node.parentNode?.removeChild(node)
  }
  const line = document.createTextNode(ZWSP)
  pre.after(line)
  caretAt(line, 1)
  return true
}
