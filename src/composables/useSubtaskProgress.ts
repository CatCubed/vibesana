import { reactive } from 'vue'
import * as api from '../api/asana'

export interface Progress {
  done: number
  total: number
}

interface Entry extends Progress {
  modified: string
  at: number
}

const MAX_AGE_MS = 10 * 60_000
const CONCURRENCY = 3

const progress = reactive(new Map<string, Progress>())
const known = new Map<string, Entry>()
const queue: { gid: string; modified: string }[] = []
const queued = new Set<string>()
let running = 0

/** Counts finished and total subtasks, ignoring section rows. */
export function countProgress(subtasks: readonly { completed: boolean; is_rendered_as_separator?: boolean }[]): Progress {
  const real = subtasks.filter((s) => !s.is_rendered_as_separator)
  return { done: real.filter((s) => s.completed).length, total: real.length }
}

/** True when a cached count can still be trusted. */
export function isFresh(entry: { modified: string; at: number } | undefined, modified: string, now: number): boolean {
  return Boolean(entry) && entry!.modified === modified && now - entry!.at < MAX_AGE_MS
}

function pump(): void {
  while (running < CONCURRENCY && queue.length) {
    // Newest request first: that is the card on screen right now.
    const job = queue.pop()!
    running += 1
    api
      .subtaskStates(job.gid)
      .then((list) => {
        const counted = countProgress(list)
        known.set(job.gid, { ...counted, modified: job.modified, at: Date.now() })
        progress.set(job.gid, counted)
      })
      .catch(() => undefined)
      .finally(() => {
        running -= 1
        queued.delete(job.gid)
        pump()
      })
  }
}

/** Asks for a task's subtask progress; cached until the task changes or the count is ten minutes old. */
export function requestSubtaskProgress(gid: string, modified: string | undefined): void {
  const stamp = modified ?? ''
  if (isFresh(known.get(gid), stamp, Date.now()) || queued.has(gid)) return
  queued.add(gid)
  queue.push({ gid, modified: stamp })
  pump()
}

/** A card left the screen before its turn came: drop the request instead of spending a call on it. */
export function cancelSubtaskProgress(gid: string): void {
  const at = queue.findIndex((job) => job.gid === gid)
  if (at === -1) return
  queue.splice(at, 1)
  queued.delete(gid)
}

/** Lets a view that already knows the exact counts (the task panel) update the card straight away. */
export function setSubtaskProgress(gid: string, value: Progress): void {
  const entry = known.get(gid)
  known.set(gid, { ...value, modified: entry?.modified ?? '', at: Date.now() })
  progress.set(gid, value)
}

export function subtaskProgressOf(gid: string): Progress | null {
  return progress.get(gid) ?? null
}
