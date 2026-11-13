import { onBeforeUnmount, onMounted, type Ref } from 'vue'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('hidden'))
}

/** Where Tab should land when it would otherwise leave `root`; null lets the browser move focus normally. */
export function trapTarget(root: HTMLElement, active: Element | null, backwards: boolean): HTMLElement | null {
  const items = focusableIn(root)
  if (!items.length) return root
  const first = items[0]
  const last = items[items.length - 1]
  if (!active || !root.contains(active)) return backwards ? last : first
  if (backwards && active === first) return last
  if (!backwards && active === last) return first
  return null
}

/**
 * Makes `root` behave like a modal for the keyboard: focus moves in when it opens (to `initial`, or the
 * first control), Tab cycles inside it, and focus returns to where it was when it closes.
 */
export function useFocusTrap(root: Ref<HTMLElement | null>, initial?: () => HTMLElement | null | undefined): void {
  let previous: HTMLElement | null = null

  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !root.value) return
    const target = trapTarget(root.value, document.activeElement, event.shiftKey)
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  onMounted(() => {
    previous = document.activeElement as HTMLElement | null
    const el = root.value
    if (!el) return
    el.addEventListener('keydown', onKey)
    if (!el.contains(document.activeElement)) (initial?.() ?? focusableIn(el)[0] ?? el).focus()
  })
  onBeforeUnmount(() => {
    root.value?.removeEventListener('keydown', onKey)
    if (previous?.isConnected) previous.focus()
  })
}
