import { reactive } from 'vue'
import type { TaskDetail } from '../types'

type Listener = (task: TaskDetail) => void

const state = reactive<{ gid: string | null; stack: string[] }>({ gid: null, stack: [] })
const listeners = new Set<Listener>()
const removedListeners = new Set<(gid: string) => void>()
let afterNavigate: (() => void) | null = null
let afterReplace: (() => void) | null = null
let afterClose: (() => void) | null = null

function push(gid: string): void {
  if (gid === state.gid) return
  state.stack = [...state.stack, gid]
  state.gid = gid
  afterNavigate?.()
}

export function useTaskOpener() {
  return {
    state,
    /** Opens a task; if one is already open it is swapped in place (no extra Back step). */
    open: (gid: string) => {
      if (gid === state.gid) return
      if (!state.gid) {
        push(gid)
        return
      }
      state.stack = [...state.stack.slice(0, -1), gid]
      state.gid = gid
      afterReplace?.()
    },
    /** Opens a task on top of the current one, so Back returns to it. */
    push,
    back: () => {
      if (state.stack.length > 1) window.history.back()
    },
    close: () => {
      if (!state.gid) return
      state.gid = null
      state.stack = []
      afterClose?.()
    },
    onClose: (fn: () => void) => {
      afterClose = fn
    },
    onNavigate: (fn: () => void) => {
      afterNavigate = fn
    },
    onReplace: (fn: () => void) => {
      afterReplace = fn
    },
    listen: (fn: Listener) => listeners.add(fn),
    unlisten: (fn: Listener) => listeners.delete(fn),
    notify: (task: TaskDetail) => listeners.forEach((fn) => fn(task)),
    listenRemoved: (fn: (gid: string) => void) => removedListeners.add(fn),
    unlistenRemoved: (fn: (gid: string) => void) => removedListeners.delete(fn),
    notifyRemoved: (gid: string) => removedListeners.forEach((fn) => fn(gid)),
  }
}
