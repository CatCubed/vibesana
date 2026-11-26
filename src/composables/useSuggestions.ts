import { ref, type Ref } from 'vue'
import * as api from '../api/asana'
import { emojiMatches } from '../emoji'
import { findTrigger, stepActive, type Trigger } from '../suggest'
import type { TypeaheadResult } from '../types'

export type MentionKind = 'user' | 'task' | 'project'
export type Suggestion =
  | { kind: MentionKind; key: string; label: string; item: TypeaheadResult }
  | { kind: 'emoji'; key: string; label: string; emoji: string }

const LIMIT: Record<MentionKind, number> = { user: 5, task: 4, project: 3 }

/**
 * The suggestion list of a rich editor: "@" offers people, tasks and projects to mention, ":na" offers
 * emoji. Call `onInput` after every input and `onKeydown` first in the key handler.
 */
export function useSuggestions(editor: Ref<HTMLElement | null>, options: { workspace: string; mentions: MentionKind[] }) {
  const items = ref<Suggestion[]>([])
  const active = ref(0)
  /** Where the caret is on screen, for placing the list. */
  const anchor = ref({ left: 0, top: 0, bottom: 0 })
  let pending: { node: Text; trigger: Trigger; end: number } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let run = 0

  function close(): void {
    clearTimeout(timer)
    run++
    pending = null
    items.value = []
  }

  function show(list: Suggestion[]): void {
    items.value = list
    active.value = 0
    const rect = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0).getBoundingClientRect() : null
    if (rect && (rect.width || rect.height || rect.top)) anchor.value = { left: rect.left, top: rect.top, bottom: rect.bottom }
    else if (editor.value) {
      const box = editor.value.getBoundingClientRect()
      anchor.value = { left: box.left + 12, top: box.top, bottom: box.top + 24 }
    }
  }

  async function searchMentions(query: string, mine: number): Promise<void> {
    const results = await Promise.all(
      options.mentions.map((kind) =>
        api
          .typeahead(options.workspace, kind, query)
          .then((found) => found.slice(0, LIMIT[kind]).map((item): Suggestion => ({ kind, key: `${kind}:${item.gid}`, label: item.name, item })))
          .catch(() => [] as Suggestion[]),
      ),
    )
    // A slower answer for an older query must not replace a newer one.
    if (mine === run) show(results.flat())
  }

  function onInput(): void {
    clearTimeout(timer)
    const selection = window.getSelection()
    const node = selection?.anchorNode
    if (!selection?.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE || !editor.value?.contains(node)) return close()
    if ((node.parentElement as HTMLElement | null)?.closest('code, pre, a')) return close()
    const trigger = findTrigger((node.textContent ?? '').slice(0, selection.anchorOffset))
    if (!trigger || (trigger.kind === 'mention' && !options.mentions.length)) return close()
    pending = { node: node as Text, trigger, end: selection.anchorOffset }
    const mine = ++run
    if (trigger.kind === 'emoji') {
      show(emojiMatches(trigger.query).map((m): Suggestion => ({ kind: 'emoji', key: `emoji:${m.name}`, label: `:${m.name}:`, emoji: m.emoji })))
      return
    }
    timer = setTimeout(() => void searchMentions(trigger.query, mine), 150)
  }

  function pick(choice: Suggestion): void {
    const target = pending
    close()
    if (!target || !target.node.isConnected) return
    const range = document.createRange()
    range.setStart(target.node, target.trigger.start)
    range.setEnd(target.node, Math.min(target.end, target.node.length))
    range.deleteContents()
    const selection = window.getSelection()
    if (choice.kind === 'emoji') {
      const text = document.createTextNode(choice.emoji)
      range.insertNode(text)
      selection?.collapse(text, text.length)
    } else {
      // Asana stores a mention as a link that carries only the object's id.
      const link = document.createElement('a')
      link.setAttribute('data-asana-gid', choice.item.gid)
      link.setAttribute('data-asana-type', choice.kind)
      link.contentEditable = 'false'
      link.textContent = choice.kind === 'user' ? `@${choice.item.name}` : choice.item.name
      range.insertNode(link)
      const space = document.createTextNode(' ')
      link.after(space)
      selection?.collapse(space, 1)
    }
    editor.value?.dispatchEvent(new Event('input', { bubbles: true }))
  }

  /** Arrow keys move the highlight, Enter or Tab picks, Esc closes. Returns true when the key was used. */
  function onKeydown(event: KeyboardEvent): boolean {
    if (!items.value.length) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      active.value = stepActive(active.value, event.key === 'ArrowDown' ? 1 : -1, items.value.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      pick(items.value[active.value])
    } else if (event.key === 'Escape') {
      close()
    } else {
      return false
    }
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return { items, active, anchor, onInput, onKeydown, pick, close }
}
