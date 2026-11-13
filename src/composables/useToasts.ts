import { reactive } from 'vue'

export interface Toast {
  id: number
  kind: 'error' | 'info' | 'success'
  text: string
  actionLabel?: string
  action?: () => void
  onExpire?: () => void
  timer?: ReturnType<typeof setTimeout>
}

const state = reactive<{ list: Toast[] }>({ list: [] })
let counter = 0

function remove(id: number, expired: boolean): void {
  const index = state.list.findIndex((t) => t.id === id)
  if (index === -1) return
  const [toast] = state.list.splice(index, 1)
  clearTimeout(toast.timer)
  if (expired) toast.onExpire?.()
}

function push(toast: Omit<Toast, 'id' | 'timer'>, ms: number): number {
  const id = ++counter
  if (toast.kind === 'error' && state.list.some((t) => t.kind === 'error' && t.text === toast.text)) return id
  const entry: Toast = { ...toast, id }
  entry.timer = setTimeout(() => remove(id, true), ms)
  state.list.push(entry)
  if (state.list.length > 5) remove(state.list[0].id, true)
  return id
}

export function useToasts() {
  return {
    state,
    error: (text: string) => push({ kind: 'error', text }, 8000),
    info: (text: string) => push({ kind: 'info', text }, 4000),
    success: (text: string) => push({ kind: 'success', text }, 3000),
    action: (text: string, label: string, run: () => void) =>
      push({ kind: 'success', text, actionLabel: label, action: run }, 6000),
    /** Shows an Undo button; `undo` runs if pressed. */
    undo: (text: string, undo: () => void) => push({ kind: 'info', text, actionLabel: 'Undo', action: undo }, 6000),
    /** Delays a destructive step: `commit` runs when the toast expires or is dismissed, `undo` if Undo is pressed. */
    deferred: (text: string, commit: () => void, undo: () => void) =>
      push({ kind: 'info', text, actionLabel: 'Undo', action: undo, onExpire: commit }, 6000),
    act: (id: number) => {
      const toast = state.list.find((t) => t.id === id)
      toast?.action?.()
      remove(id, false)
    },
    dismiss: (id: number) => remove(id, true),
    flush: () => {
      for (const toast of [...state.list]) remove(toast.id, true)
    },
  }
}
