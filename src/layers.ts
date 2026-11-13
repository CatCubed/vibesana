import { onBeforeUnmount, watch, type Ref } from 'vue'

/** Open popups, menus and dialogs, innermost last. Escape closes only the top one. */
const layers: (() => void)[] = []

export function pushLayer(close: () => void): () => void {
  layers.push(close)
  return () => {
    const at = layers.lastIndexOf(close)
    if (at !== -1) layers.splice(at, 1)
  }
}

export function hasOpenLayer(): boolean {
  return layers.length > 0
}

/** Closes the innermost open layer. Returns false when nothing was open. */
export function closeTopLayer(): boolean {
  const close = layers[layers.length - 1]
  if (!close) return false
  close()
  return true
}

export function onLayerKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !closeTopLayer()) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

if (typeof window !== 'undefined') window.addEventListener('keydown', onLayerKey, true)

/** Registers a popup as a layer while it is open, and closes it on a click outside `root`. */
export function useDismiss(root: Ref<HTMLElement | null>, open: Ref<boolean>, close: () => void = () => (open.value = false)): void {
  let remove: (() => void) | null = null
  function onPointer(event: MouseEvent): void {
    if (!root.value || root.value.contains(event.target as Node)) return
    // A click in a teleported list or dialog opened from inside this popup is not a click outside it.
    const layer = event.target instanceof Element ? event.target.closest('[data-layer]') : null
    if (layer && !layer.contains(root.value)) return
    close()
  }
  function detach(): void {
    remove?.()
    remove = null
    document.removeEventListener('mousedown', onPointer)
  }
  watch(
    open,
    (isOpen) => {
      detach()
      if (!isOpen) return
      remove = pushLayer(close)
      document.addEventListener('mousedown', onPointer)
    },
    { immediate: true },
  )
  onBeforeUnmount(detach)
}
