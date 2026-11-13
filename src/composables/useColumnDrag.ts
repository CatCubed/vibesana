import { reactive } from 'vue'

/** The board column being dragged to a new place, and the project it belongs to. */
const state = reactive<{ gid: string | null; project: string | null }>({ gid: null, project: null })

function clear(): void {
  state.gid = null
  state.project = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragend', clear)
  window.addEventListener('drop', () => setTimeout(clear), true)
}

export function useColumnDrag() {
  return {
    state,
    start: (gid: string, project: string) => {
      state.gid = gid
      state.project = project
    },
    clear,
  }
}
