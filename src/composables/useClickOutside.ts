import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** A click inside a floating layer that lives outside the DOM tree it belongs to (teleported lists, dialogs). */
export function inDetachedLayer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-layer]') !== null
}

export function useClickOutside(target: Ref<HTMLElement | null>, handler: () => void): void {
  function onPointer(event: MouseEvent): void {
    if (!target.value || target.value.contains(event.target as Node)) return
    if (inDetachedLayer(event.target) && !(event.target as Element).closest('[data-layer]')!.contains(target.value)) return
    handler()
  }
  onMounted(() => document.addEventListener('mousedown', onPointer))
  onBeforeUnmount(() => document.removeEventListener('mousedown', onPointer))
}
