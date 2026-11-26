import { editLink } from './richlink'
import { setBlock, type BlockKind } from './richblocks'

const BLOCKS = new Set(['DIV', 'P', 'UL', 'OL', 'LI', 'H1', 'H2', 'BLOCKQUOTE', 'PRE', 'HR'])
const ZWSP = '​'

interface Caret {
  node: Text
  offset: number
  before: string
}

function caretIn(editor: HTMLElement): Caret | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !selection.isCollapsed) return null
  const node = selection.anchorNode
  if (!node || node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) return null
  const offset = selection.anchorOffset
  return { node: node as Text, offset, before: (node.textContent ?? '').slice(0, offset) }
}

function isBoundary(node: Node | null): boolean {
  return !node || node.nodeName === 'BR' || BLOCKS.has(node.nodeName)
}

/** The sibling before `node`, skipping empty text nodes. */
function previousReal(node: Node): Node | null {
  let prev = node.previousSibling
  while (prev && prev.nodeType === Node.TEXT_NODE && !prev.textContent) prev = prev.previousSibling
  return prev
}

/** True when a line starts right after `prev`: nothing, a break or block element, or text ending in a newline. */
function endsLine(prev: Node | null): boolean {
  if (isBoundary(prev)) return true
  return prev!.nodeType === Node.TEXT_NODE && (prev!.textContent ?? '').endsWith('\n')
}

function placeCaret(node: Node, offset: number): void {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

const MARKERS: { pattern: RegExp; kind: 'ul' | 'ol' | 'h1' | 'h2' | 'pre' | 'blockquote' }[] = [
  { pattern: /^>[ \u00a0]$/, kind: 'blockquote' },
  { pattern: /^```[ \u00a0]$/, kind: 'pre' },
  { pattern: /^[-*][  ]$/, kind: 'ul' },
  { pattern: /^1\.[  ]$/, kind: 'ol' },
  { pattern: /^#[  ]$/, kind: 'h1' },
  { pattern: /^##[  ]$/, kind: 'h2' },
]

/**
 * When the caret sits right after a line-start marker ("- ", "1. ", "# "), turns that line into a list item or heading.
 * Only handles lines that are direct children of the editor.
 */
function blockShortcut(editor: HTMLElement, caret: Caret): boolean {
  // The line is either directly in the editor, or the first thing in a line wrapper (<div>/<p>) the browser made.
  const container = caret.node.parentElement
  if (!container) return false
  const wrapped = container !== editor
  if (wrapped && !(container.parentElement === editor && (container.tagName === 'DIV' || container.tagName === 'P'))) {
    return false
  }
  const start = caret.before.lastIndexOf('\n') + 1
  if (wrapped && (start > 0 || previousReal(caret.node))) return false
  if (start === 0 && !endsLine(previousReal(caret.node))) return false
  const typed = caret.before.slice(start).split(ZWSP).join('')
  const marker = MARKERS.find((m) => m.pattern.test(typed))
  if (!marker) return false

  // Isolate the current line into its own text node, without the marker.
  let line = caret.node
  if (start > 0) {
    line = caret.node.splitText(start)
    caret.node.deleteData(start - 1, 1)
  }
  line.deleteData(0, caret.offset - start)
  let stop = false
  const breakAt = (line.textContent ?? '').indexOf('\n')
  if (breakAt !== -1) {
    line.splitText(breakAt).deleteData(0, 1)
    stop = true
  }

  const nodes: Node[] = [line]
  let next = line.nextSibling
  while (!stop && next && !isBoundary(next)) {
    if (next.nodeType === Node.TEXT_NODE) {
      const text = next as Text
      const at = (text.textContent ?? '').indexOf('\n')
      if (at === 0) {
        text.deleteData(0, 1)
        stop = true
        break
      }
      if (at > 0) {
        text.splitText(at).deleteData(0, 1)
        nodes.push(text)
        stop = true
        break
      }
    }
    nodes.push(next)
    next = next.nextSibling
  }

  const prev = previousReal(line)
  if (prev?.nodeName === 'BR') prev.parentNode?.removeChild(prev)
  else if (prev?.nodeType === Node.TEXT_NODE && (prev.textContent ?? '').endsWith('\n')) {
    ;(prev as Text).deleteData((prev.textContent ?? '').length - 1, 1)
  }

  const isList = marker.kind === 'ul' || marker.kind === 'ol'
  const inner = document.createElement(isList ? 'li' : marker.kind)
  const anchor: Node = wrapped ? container : line
  const before = previousReal(anchor)
  if (isList && before instanceof HTMLElement && before.tagName.toLowerCase() === marker.kind) {
    before.appendChild(inner)
  } else if (isList) {
    const list = document.createElement(marker.kind)
    editor.insertBefore(list, anchor)
    list.appendChild(inner)
  } else {
    editor.insertBefore(inner, anchor)
  }
  for (const node of nodes) inner.appendChild(node)
  if (!stop && next?.nodeName === 'BR') next.remove()
  if (wrapped && !container.textContent && !container.querySelector('img')) container.remove()
  if (!inner.textContent) {
    inner.textContent = ''
    inner.appendChild(document.createElement('br'))
    placeCaret(inner, 0)
  } else {
    placeCaret(line, 0)
  }
  return true
}

/**
 * Typing "---" at the start of a line turns it into a divider (a horizontal rule), as in Asana.
 * Text already on that line after the dashes stays, on the line under the divider — so a divider can be
 * put above existing text by typing the dashes in front of it.
 */
function dividerShortcut(editor: HTMLElement, caret: Caret): boolean {
  const container = caret.node.parentElement
  if (!container) return false
  const wrapped = container !== editor
  if (wrapped && !(container.parentElement === editor && (container.tagName === 'DIV' || container.tagName === 'P'))) {
    return false
  }
  const start = caret.before.lastIndexOf('\n') + 1
  if (wrapped && (start > 0 || previousReal(caret.node))) return false
  if (start === 0 && !endsLine(previousReal(caret.node))) return false
  if (caret.before.slice(start).split(ZWSP).join('') !== '---') return false

  let following = caret.node.nextSibling
  while (following && following.nodeType === Node.TEXT_NODE && !(following.textContent ?? '').split(ZWSP).join('')) {
    following = following.nextSibling
  }

  // Cut the line out: the dashes, and the line breaks around them (a rule is a block of its own).
  const after = caret.node.splitText(caret.offset)
  caret.node.deleteData(start, caret.node.length - start)
  if (start > 0) caret.node.deleteData(start - 1, 1)
  else {
    const prev = previousReal(caret.node)
    if (prev?.nodeName === 'BR') prev.parentNode?.removeChild(prev)
    else if (prev?.nodeType === Node.TEXT_NODE && (prev.textContent ?? '').endsWith('\n')) {
      ;(prev as Text).deleteData((prev.textContent ?? '').length - 1, 1)
    }
  }
  if ((after.textContent ?? '').startsWith('\n')) after.deleteData(0, 1)
  else if (!after.length && following?.nodeName === 'BR') following.remove()
  else if (!after.length && following?.nodeType === Node.TEXT_NODE && (following.textContent ?? '').startsWith('\n')) {
    ;(following as Text).deleteData(0, 1)
  }

  const rule = document.createElement('hr')
  if (wrapped) editor.insertBefore(rule, container)
  else editor.insertBefore(rule, after)

  // The caret continues on the line under the rule.
  if (wrapped) {
    if (!container.textContent?.split(ZWSP).join('') && !container.querySelector('img, br')) container.appendChild(document.createElement('br'))
    placeCaret(container, 0)
  } else {
    if (!after.length) after.data = ZWSP
    placeCaret(after, after.data.startsWith(ZWSP) ? 1 : 0)
  }
  return true
}

const INLINE: { pattern: RegExp; tag: string }[] = [
  { pattern: /`([^`\n]+)`$/, tag: 'code' },
  { pattern: /\*\*([^*\n]+)\*\*$/, tag: 'strong' },
  { pattern: /~~([^~\n]+)~~$/, tag: 's' },
  { pattern: /(?<=^|[\s(])_([^_\n]+)_$/, tag: 'em' },
]

function inlineShortcut(caret: Caret): boolean {
  if (caret.node.parentElement?.closest('code, pre, a')) return false
  for (const { pattern, tag } of INLINE) {
    const match = caret.before.match(pattern)
    if (!match || !match[1].trim()) continue
    const start = caret.offset - match[0].length
    caret.node.deleteData(start, match[0].length)
    const rest = caret.node.splitText(start)
    const element = document.createElement(tag)
    element.textContent = match[1]
    const after = document.createTextNode(ZWSP)
    rest.before(element, after)
    placeCaret(after, 1)
    return true
  }
  return false
}

const ARROWS: { typed: string; arrow: string }[] = [
  { typed: '->', arrow: '→' },
  { typed: '<-', arrow: '←' },
]

/**
 * "->" followed by a space becomes an arrow, as in Asana ("<-" likewise). Longer runs such as "-->" or
 * "<->" are left alone, and so is anything inside code.
 */
function arrowShortcut(caret: Caret): boolean {
  if (caret.node.parentElement?.closest('code, pre')) return false
  const match = caret.before.match(/(^|[^-<>])(->|<-)([ \u00a0])$/)
  if (!match) return false
  const found = ARROWS.find((a) => a.typed === match[2])
  if (!found) return false
  const start = caret.offset - match[2].length - 1
  caret.node.replaceData(start, match[2].length, found.arrow)
  placeCaret(caret.node, start + found.arrow.length + 1)
  return true
}

export interface AutoFormatOptions {
  /** "---" makes a divider. Only where Asana accepts one: descriptions, not comments. */
  divider?: boolean
}

/** Call from an editor's `input` event: turns Markdown-style shortcuts into formatting. */
export function autoFormat(editor: HTMLElement, event?: Event, options: AutoFormatOptions = {}): boolean {
  const type = (event as InputEvent | undefined)?.inputType ?? ''
  if (type.startsWith('delete') || type.startsWith('history')) return false
  const caret = caretIn(editor)
  if (!caret) return false
  return (
    (options.divider === true && dividerShortcut(editor, caret)) ||
    blockShortcut(editor, caret) ||
    inlineShortcut(caret) ||
    arrowShortcut(caret)
  )
}

/** Enter inside a heading starts a normal line below it. Returns true when handled. */
export function exitHeadingOnEnter(editor: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey) return false
  const anchor = window.getSelection()?.anchorNode
  const element = anchor instanceof Element ? anchor : anchor?.parentElement
  const heading = element?.closest('h1, h2')
  if (!heading || !editor.contains(heading)) return false
  event.preventDefault()
  const line = document.createTextNode(ZWSP)
  heading.after(line)
  placeCaret(line, 1)
  return true
}

export function wrapSelectionInCode(): void {
  const selection = window.getSelection()
  if (!selection?.rangeCount || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  const code = document.createElement('code')
  code.appendChild(range.extractContents())
  range.insertNode(code)
  selection.selectAllChildren(code)
}

/** Which formatting action a key press asks for, or null. Uses the physical key so it works on any layout. */
export function formatHotkey(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>): string | null {
  if (!(event.ctrlKey || event.metaKey)) return null
  if (event.altKey) {
    if (event.shiftKey) return null
    if (event.code === 'Digit0') return 'block:p'
    if (event.code === 'Digit1') return 'block:h1'
    if (event.code === 'Digit2') return 'block:h2'
    return null
  }
  if (!event.shiftKey) {
    if (event.code === 'KeyB') return 'bold'
    if (event.code === 'KeyI') return 'italic'
    if (event.code === 'KeyU') return 'underline'
    if (event.code === 'KeyE') return 'code'
    if (event.code === 'KeyK') return 'link'
    return null
  }
  if (event.code === 'KeyX') return 'strikeThrough'
  if (event.code === 'KeyM') return 'code'
  if (event.code === 'KeyC') return 'block:pre'
  if (event.code === 'Digit7') return 'insertOrderedList'
  if (event.code === 'Digit8') return 'insertUnorderedList'
  return null
}

/** Applies Ctrl+B / I / U and friends inside a rich editor. Returns true when handled. */
export function handleFormatHotkey(event: KeyboardEvent): boolean {
  const action = formatHotkey(event)
  if (!action) return false
  event.preventDefault()
  event.stopPropagation()
  if (action.startsWith('block:')) {
    setBlock(event.currentTarget as HTMLElement, action.slice(6) as BlockKind)
  } else if (action === 'code') {
    wrapSelectionInCode()
  } else if (action === 'link') {
    void editLink(event.currentTarget as HTMLElement)
    return true
  } else {
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(action)
  }
  ;(event.currentTarget as HTMLElement | null)?.dispatchEvent(new Event('input', { bubbles: true }))
  document.dispatchEvent(new Event('selectionchange'))
  return true
}
