import { useDialog } from './composables/useDialog'

/**
 * Turns what a person typed into a link address the editor will keep: adds https:// to a bare
 * address, mailto: to an e-mail, and rejects other schemes (javascript:, file:, …).
 */
export function normalizeUrl(text: string): string | null {
  const value = text.trim()
  if (!value || /\s/.test(value)) return null
  if (/^(https?:\/\/|mailto:)\S+$/i.test(value)) return value
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(value)) return `mailto:${value}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[\w-]+(\.[\w-]+)*:\d+/.test(value)) return null
  return `https://${value}`
}

/**
 * Pasting a web address while text is selected links that text instead of replacing it, as in Asana.
 * Returns true when it did; false leaves the paste to be handled normally.
 */
export function linkSelectionTo(editor: HTMLElement, pasted: string): boolean {
  const url = pasted.trim()
  if (!/^https?:\/\/\S+$/i.test(url)) return false
  const selection = window.getSelection()
  if (!selection?.rangeCount || selection.isCollapsed) return false
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer) || !range.toString().trim()) return false
  const inside = (node: Node): Element | null => (node instanceof Element ? node : node.parentElement)?.closest('a, code, pre') ?? null
  if (inside(range.startContainer) || inside(range.endContainer) || range.cloneContents().querySelector('a, li, h1, h2, pre, blockquote, hr, div, p, br')) {
    return false
  }
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.appendChild(range.extractContents())
  range.insertNode(link)
  selection.removeAllRanges()
  const after = document.createRange()
  after.setStartAfter(link)
  after.collapse(true)
  selection.addRange(after)
  return true
}

function restore(range: Range): void {
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Asks for an address and links the selection (or inserts the address itself); on an existing link, edits or removes it. */
export async function editLink(editor: HTMLElement): Promise<void> {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return
  const range = selection.getRangeAt(0).cloneRange()
  const start = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement
  const existing = start?.closest('a') ?? null
  const link = existing && editor.contains(existing) ? existing : null

  const answer = await useDialog().prompt({
    title: link ? 'Edit link' : 'Add link',
    message: link ? 'Clear the address to remove the link.' : undefined,
    value: link?.getAttribute('href') ?? '',
    placeholder: 'https://…',
    confirmLabel: link ? 'Save' : 'Add',
    allowEmpty: Boolean(link),
  })
  editor.focus()
  restore(range)
  if (answer === null) return

  const url = normalizeUrl(answer)
  if (link) {
    if (!answer) link.replaceWith(...link.childNodes)
    else if (url) link.setAttribute('href', url)
  } else if (url) {
    if (range.collapsed) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.textContent = answer.trim()
      range.insertNode(anchor)
      range.setStartAfter(anchor)
      range.collapse(true)
      restore(range)
    } else {
      document.execCommand('createLink', false, url)
    }
  }
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  document.dispatchEvent(new Event('selectionchange'))
}
