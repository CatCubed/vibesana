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

/** Turns the line at the caret into a heading or code block, or back into normal text. Pressing the same kind again toggles it off. */
export function setBlock(editor: HTMLElement, kind: BlockKind): boolean {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return false
  const range = selection.getRangeAt(0)
  let node: Node | null = range.startContainer
  let offset = range.startOffset
  if (!editor.contains(node)) return false
  if (node === editor) {
    node = editor.childNodes[offset] ?? editor.lastChild
    offset = 0
    if (!node) {
      node = editor.appendChild(document.createTextNode(''))
    }
  }
  const element = node instanceof Element ? node : node.parentElement
  const item = element?.closest('li')
  if (item && editor.contains(item)) return false
  const existing = element?.closest('h1, h2, pre, blockquote')
  if (existing && existing !== editor && editor.contains(existing)) {
    return convertExisting(existing, existing.tagName.toLowerCase() === kind ? 'p' : kind)
  }
  if (kind === 'p') return false
  return wrapLine(editor, node, offset, kind)
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
