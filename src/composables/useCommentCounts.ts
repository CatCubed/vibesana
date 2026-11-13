import { reactive } from 'vue'
import * as api from '../api/asana'
import { readCache, writeCache } from '../cache'

interface Entry {
  modified: string
  count: number
}

const CACHE_KEY = 'comment-counts'
const CONCURRENCY = 3

const counts = reactive(new Map<string, number>())
const known = new Map<string, Entry>()
const queue: { gid: string; modified: string }[] = []
const queued = new Set<string>()
let running = 0
let loaded: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

function load(): Promise<void> {
  loaded ??= readCache<[string, Entry][]>(CACHE_KEY).then((entries) => {
    for (const [gid, entry] of entries ?? []) {
      known.set(gid, entry)
      counts.set(gid, entry.count)
    }
  })
  return loaded
}

function save(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void writeCache(CACHE_KEY, [...known.entries()].slice(-5000)), 2000)
}

function pump(): void {
  while (running < CONCURRENCY && queue.length) {
    // Newest request first: that is the card on screen right now.
    const job = queue.pop()!
    running += 1
    api
      .commentCount(job.gid)
      .then((count) => {
        known.set(job.gid, { modified: job.modified, count })
        counts.set(job.gid, count)
        save()
      })
      .catch(() => undefined)
      .finally(() => {
        running -= 1
        queued.delete(job.gid)
        pump()
      })
  }
}

/** Asks for a task's comment count; uses the cached value unless the task changed since. */
export function requestCommentCount(gid: string, modified: string | undefined): void {
  if (!modified) return
  void load().then(() => {
    if (known.get(gid)?.modified === modified || queued.has(gid)) return
    queued.add(gid)
    queue.push({ gid, modified })
    pump()
  })
}

/** A card left the screen before its turn came: drop the request instead of spending a call on it. */
export function cancelCommentCount(gid: string): void {
  const at = queue.findIndex((job) => job.gid === gid)
  if (at === -1) return
  queue.splice(at, 1)
  queued.delete(gid)
}

/** Lets the task panel, which has the real comments in hand, put the right number on the card at once. */
export function setCommentCount(gid: string, count: number): void {
  counts.set(gid, count)
  const entry = known.get(gid)
  if (entry) {
    known.set(gid, { ...entry, count })
    save()
  }
}

export function commentCountOf(gid: string): number {
  return counts.get(gid) ?? 0
}
