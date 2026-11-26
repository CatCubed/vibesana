import { reactive } from 'vue'
import type { TaskDetail } from '../types'

type Listener = (task: TaskDetail) => void

const state = reactive<{ gid: string | null; stack: string[] }>({ gid: null, stack: [] })
const listeners = new Set<Listener>()
const removedListeners = new Set<(gid: string) => void>()
let afterNavigate: (() => void) | null = null
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
    /**
     * Opens a task. If one is already open it takes its place in the panel (the panel's own back arrow is
     * for drilling into subtasks), but it is still a new browser-history step, so Back returns to the old one.
     */
    open: (gid: string) => {
      if (gid === state.gid) return
      if (!state.gid) {
        push(gid)
        return
      }
      state.stack = [...state.stack.slice(0, -1), gid]
      state.gid = gid
      afterNavigate?.()
    },
    /** Opens a task on top of the current one, so Back returns to it. */
    push,
    /** The panel's back arrow: up to the task this one was opened from. Also a history step, so Forward returns. */
    back: () => {
      if (state.stack.length < 2) return
      state.stack = state.stack.slice(0, -1)
      state.gid = state.stack[state.stack.length - 1]
      afterNavigate?.()
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
    listen: (fn: Listener) => listeners.add(fn),
    unlisten: (fn: Listener) => listeners.delete(fn),
    notify: (task: TaskDetail) => listeners.forEach((fn) => fn(task)),
    listenRemoved: (fn: (gid: string) => void) => removedListeners.add(fn),
    unlistenRemoved: (fn: (gid: string) => void) => removedListeners.delete(fn),
    notifyRemoved: (gid: string) => removedListeners.forEach((fn) => fn(gid)),
  }
}
