import { clear, del, entries, get, set } from 'idb-keyval'

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    return await get<T>(key)
  } catch {
    return undefined
  }
}

/** Drops everything cached (boards, My Tasks, activity, comment counts). */
export async function clearCache(): Promise<void> {
  try {
    await clear()
  } catch {
    /* cache is best effort */
  }
}

const BOARD_MAX_AGE_MS = 30 * 86_400_000

/** Which cached boards are old enough to drop: not opened (saved) for a month, or saved before boards carried a date. */
export function staleBoardKeys(items: [unknown, unknown][], now: number): string[] {
  return items
    .filter(([key, value]) => {
      if (typeof key !== 'string' || !key.startsWith('board:')) return false
      const savedAt = (value as { savedAt?: number } | null)?.savedAt
      return typeof savedAt !== 'number' || now - savedAt > BOARD_MAX_AGE_MS
    })
    .map(([key]) => key as string)
}

let pruned = false
/** Once per session, forgets boards nobody opened for a month so the browser store does not grow forever. */
export async function pruneBoardCache(): Promise<void> {
  if (pruned) return
  pruned = true
  try {
    for (const key of staleBoardKeys(await entries(), Date.now())) await del(key)
  } catch {
    /* cache is best effort */
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, JSON.parse(JSON.stringify(value)))
  } catch {
    /* cache is best effort */
  }
}
