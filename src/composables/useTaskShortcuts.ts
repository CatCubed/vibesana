import { reactive } from 'vue'
import { readSetting, writeSetting } from '../settings'

export interface TaskRef {
  gid: string
  name: string
  completed: boolean
}

export const RECENT_LIMIT = 8

/** Puts `item` first in the recent list, without duplicates, capped at `limit`. */
export function addRecent(list: readonly TaskRef[], item: TaskRef, limit = RECENT_LIMIT): TaskRef[] {
  return [item, ...list.filter((entry) => entry.gid !== item.gid)].slice(0, limit)
}

/** Adds `item` to the pinned list, or removes it if it is already there. */
export function togglePinned(list: readonly TaskRef[], item: TaskRef): TaskRef[] {
  return list.some((entry) => entry.gid === item.gid)
    ? list.filter((entry) => entry.gid !== item.gid)
    : [...list, item]
}

/** Updates the stored name and completion of `item` wherever it appears in `list`. */
export function refreshIn(list: readonly TaskRef[], item: TaskRef): TaskRef[] {
  return list.map((entry) => (entry.gid === item.gid ? { ...item } : entry))
}

const state = reactive<{ recent: TaskRef[]; pinned: TaskRef[] }>({
  recent: readSetting<TaskRef[]>('recent-tasks', []),
  pinned: readSetting<TaskRef[]>('pinned-tasks', []),
})

function persist(): void {
  writeSetting('recent-tasks', state.recent)
  writeSetting('pinned-tasks', state.pinned)
}

export function useTaskShortcuts() {
  return {
    state,
    /** Call when a task is opened or changes: keeps Recent fresh and pinned names up to date. */
    record: (item: TaskRef, opened = true) => {
      state.recent = opened ? addRecent(state.recent, item) : refreshIn(state.recent, item)
      state.pinned = refreshIn(state.pinned, item)
      persist()
    },
    togglePin: (item: TaskRef) => {
      state.pinned = togglePinned(state.pinned, item)
      persist()
    },
    isPinned: (gid: string) => state.pinned.some((entry) => entry.gid === gid),
    forget: (gid: string) => {
      state.recent = state.recent.filter((entry) => entry.gid !== gid)
      state.pinned = state.pinned.filter((entry) => entry.gid !== gid)
      persist()
    },
    clearRecent: () => {
      state.recent = []
      persist()
    },
  }
}
