import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { chordKey, createChordTracker } from '../tabchord'
import { hasOpenLayer } from '../layers'
import { focusableIn } from './useFocusTrap'

function isTypingField(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable
}

/**
 * Tab shortcuts for the open task. A handler returns false to say "not mine", which lets the key through.
 *
 * Active only while focus is inside `root` (or nowhere), and never while a popup or dialog is on top.
 * In a text field the shortcuts are off and Tab works as usual — except in fields marked
 * `data-chords` (subtask names), where Tab is the shortcut prefix, as in Asana.
 */
export function useTabChords(root: Ref<HTMLElement | null>, handlers: Record<string, () => boolean | void>): void {
  const chord = createChordTracker()

  function scope(event: KeyboardEvent): 'field' | 'panel' | null {
    const target = event.target as HTMLElement | null
    if (!target || !root.value || hasOpenLayer()) return null
    if (target !== document.body && !root.value.contains(target)) return null
    if (!isTypingField(target)) return 'panel'
    return target.hasAttribute('data-chords') ? 'field' : null
  }

  function onKeyDown(event: KeyboardEvent): void {
    const where = scope(event)
    if (!where) return
    if (event.key === 'Tab') {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      if (!event.repeat) chord.tabDown(performance.now())
      return
    }
    const key = chordKey(event)
    if (!key || !handlers[key] || !chord.take(performance.now())) return
    if (handlers[key]() === false) return
    event.preventDefault()
    event.stopPropagation()
  }

  /** A plain Tab tap still moves focus through the panel, since the keydown had to be swallowed. */
  function onKeyUp(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return
    const tapped = chord.tabUp()
    const where = scope(event)
    if (!tapped || where !== 'panel' || !root.value) return
    const items = focusableIn(root.value)
    if (!items.length) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = items[(at + (event.shiftKey ? -1 : 1) + items.length) % items.length] ?? items[0]
    next.focus()
    if (isTypingField(next) && !next.hasAttribute('data-chords')) chord.disarm()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp, true)
  })
}
