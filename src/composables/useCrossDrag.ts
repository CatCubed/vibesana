import { reactive } from 'vue'

/** Cards being dragged, shared between boards so a card can be dropped on another project. */
const state = reactive<{ gids: string[]; project: string | null }>({ gids: [], project: null })

function clear(): void {
  state.gids = []
  state.project = null
}

if (typeof window !== 'undefined') {
  // The source card can be unmounted mid-drag (switching tabs), so its dragend may never fire.
  window.addEventListener('dragend', clear)
  window.addEventListener('drop', () => setTimeout(clear), true)
  window.addEventListener('mousedown', clear, true)
}

export function useCrossDrag() {
  return {
    state,
    start: (gids: string[], project: string) => {
      state.gids = gids
      state.project = project
    },
    clear,
  }
}
