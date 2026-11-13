import { reactive, ref, shallowRef } from 'vue'
import * as api from '../api/asana'
import { pruneBoardCache, readCache, writeCache } from '../cache'
import { landingIndex } from '../ordering'
import { backoffMs, mapLimit } from '../concurrency'
import { useConnection } from './useConnection'
import type { BoardTask, Card, Section, TaskDetail } from '../types'

/** Asana returns the first page of a column in its real order; cards loaded beyond it keep their place after it. */
export function mergeFirstPage(existing: Card[], page: Card[]): Card[] {
  const inPage = new Set(page.map((c) => c.gid))
  return [...page, ...existing.filter((c) => !inPage.has(c.gid))]
}

export interface Column {
  cards: Card[]
  next: string | null
  fresh: boolean
  loading: boolean
  error: string | null
}

interface CachedBoard {
  /** When this board was last saved; boards untouched for a month are pruned. */
  savedAt?: number
  sections: Section[]
  columns: Record<string, { cards: Card[]; next: string | null }>
}

const SYNC_INTERVAL_MS = 15_000

export function useBoard(project: string, showCompleted: boolean) {
  const sections = shallowRef<Section[]>([])
  const columns = reactive(new Map<string, Column>())
  const error = ref<string | null>(null)
  const cacheKey = `board:${project}:${showCompleted ? "all" : "open"}`
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let syncTimer: ReturnType<typeof setInterval> | undefined
  let syncToken: string | null = null
  let syncing = false
  /** Polls that failed in a row, and the earliest time the next one may run. */
  let syncFailures = 0
  let nextSyncAt = 0
  /** Moves and completions on their way to Asana. A poll in between would show the old state for a moment. */
  let pendingWrites = 0
  /** Set once a view asked for every task (list, calendar, grouping); reloads then load everything again. */
  let wantAll = false
  const connection = useConnection()

  function column(section: string): Column {
    let existing = columns.get(section)
    if (!existing) {
      columns.set(section, { cards: [], next: null, fresh: false, loading: false, error: null })
      existing = columns.get(section)!
    }
    return existing
  }

  function persist(): void {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      const cached: CachedBoard = { savedAt: Date.now(), sections: sections.value, columns: {} }
      for (const [gid, col] of columns) cached.columns[gid] = { cards: col.cards, next: col.next }
      void writeCache(cacheKey, cached)
    }, 500)
  }

  async function load(): Promise<void> {
    const cached = await readCache<CachedBoard>(cacheKey)
    void pruneBoardCache()
    if (cached) {
      sections.value = cached.sections
      for (const [gid, col] of Object.entries(cached.columns)) {
        Object.assign(column(gid), { cards: col.cards, next: col.next })
      }
    }
    await refreshSections()
    startSync()
  }

  async function refreshSections(): Promise<void> {
    try {
      sections.value = await api.sections(project)
      error.value = null
      // Columns deleted elsewhere would otherwise linger in memory, in the cache and in the task count.
      const alive = new Set(sections.value.map((s) => s.gid))
      for (const gid of [...columns.keys()]) if (!alive.has(gid)) columns.delete(gid)
      persist()
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function ensureColumn(section: string): Promise<void> {
    const col = column(section)
    if (col.fresh || col.loading) return
    await fetchPage(section, undefined)
  }

  async function loadMore(section: string): Promise<void> {
    const col = column(section)
    if (!col.next || col.loading) return
    await fetchPage(section, col.next)
  }

  async function fetchPage(section: string, offset: string | undefined): Promise<void> {
    const col = column(section)
    col.loading = true
    try {
      const page = await api.sectionTasks(section, showCompleted, offset)
      if (offset) {
        const known = new Set(col.cards.map((c) => c.gid))
        col.cards.push(...page.data.filter((c) => !known.has(c.gid)))
      } else {
        col.cards = page.data
      }
      col.next = page.next_page?.offset ?? null
      col.fresh = true
      col.error = null
      persist()
    } catch (e) {
      col.error = (e as Error).message
    } finally {
      col.loading = false
    }
  }

  const MAX_PAGES = 40

  async function loadAll(): Promise<void> {
    wantAll = true
    await mapLimit(sections.value, 4, async (section) => {
      const col = column(section.gid)
      await ensureColumn(section.gid)
      let pages = 1
      // Stop on the first failed page instead of hammering it; the column shows the error and a retry.
      while (col.next && !col.loading && !col.error && pages++ < MAX_PAGES) await loadMore(section.gid)
      if (col.next && !col.error && pages > MAX_PAGES) col.error = `Showing the first ${col.cards.length} tasks of this column.`
    })
  }

  function locate(gid: string): { section: string; index: number } | null {
    for (const [section, col] of columns) {
      const index = col.cards.findIndex((c) => c.gid === gid)
      if (index !== -1) return { section, index }
    }
    return null
  }

  /** Moves a card optimistically. Resolves to false (and puts the card back) when Asana refused. */
  async function move(gid: string, toSection: string, toIndex: number): Promise<boolean> {
    const from = locate(gid)
    if (!from) return false
    const source = column(from.section)
    const target = column(toSection)
    const [card] = source.cards.splice(from.index, 1)
    const index = landingIndex(from.section === toSection, from.index, toIndex)
    target.cards.splice(index, 0, card)
    persist()

    const before = target.cards[index + 1]
    const after = target.cards[index - 1]
    pendingWrites++
    try {
      await api.moveTask(
        toSection,
        gid,
        before ? { insert_before: before.gid } : after ? { insert_after: after.gid } : {},
      )
    } catch (e) {
      error.value = `Move failed: ${(e as Error).message}`
      // A sync may have replaced the card meanwhile; then the board already shows the truth.
      const at = target.cards.indexOf(card)
      if (at !== -1) {
        target.cards.splice(at, 1)
        source.cards.splice(Math.min(from.index, source.cards.length), 0, card)
      }
      persist()
      return false
    } finally {
      pendingWrites--
    }
    return true
  }

  async function addCard(section: string, name: string, bottom = false): Promise<void> {
    try {
      const card = await api.createTask(project, section, name)
      const cards = column(section).cards
      const last = cards[cards.length - 1]
      if (bottom) {
        if (last) await api.moveTask(section, card.gid, { insert_after: last.gid })
        cards.push(card)
      } else {
        await api.moveTask(section, card.gid, {})
        cards.unshift(card)
      }
      persist()
    } catch (e) {
      error.value = `Create failed: ${(e as Error).message}`
    }
  }

  /** Completes or reopens a card optimistically. Resolves to false when Asana refused. */
  async function setCompleted(gid: string, completed: boolean): Promise<boolean> {
    const found = locate(gid)
    if (!found) return false
    const card = column(found.section).cards[found.index]
    card.completed = completed
    if (completed && !showCompleted) column(found.section).cards.splice(found.index, 1)
    persist()
    pendingWrites++
    try {
      await api.updateTask(gid, { completed })
    } catch (e) {
      error.value = `Update failed: ${(e as Error).message}`
      card.completed = !completed
      const cards = column(found.section).cards
      if (completed && !showCompleted && !cards.includes(card)) cards.splice(Math.min(found.index, cards.length), 0, card)
      persist()
      return false
    } finally {
      pendingWrites--
    }
    return true
  }

  async function addSection(name: string, anchor?: { gid: string; side: 'before' | 'after' }): Promise<void> {
    try {
      const created = await api.createSection(
        project,
        name,
        anchor ? (anchor.side === 'after' ? { insert_after: anchor.gid } : { insert_before: anchor.gid }) : {},
      )
      const list = [...sections.value]
      const at = anchor ? list.findIndex((s) => s.gid === anchor.gid) : -1
      const index = at === -1 ? list.length : anchor!.side === 'after' ? at + 1 : at
      list.splice(index, 0, created)
      sections.value = list
      persist()
    } catch (e) {
      error.value = `Add column failed: ${(e as Error).message}`
    }
  }

  async function renameSection(gid: string, name: string): Promise<void> {
    const previous = sections.value
    sections.value = previous.map((s) => (s.gid === gid ? { ...s, name } : s))
    try {
      await api.renameSection(gid, name)
      persist()
    } catch (e) {
      error.value = `Rename failed: ${(e as Error).message}`
      sections.value = previous
    }
  }

  async function deleteSection(gid: string): Promise<void> {
    const previous = sections.value
    sections.value = previous.filter((s) => s.gid !== gid)
    try {
      await api.deleteSection(gid)
      columns.delete(gid)
      persist()
    } catch (e) {
      error.value = `Delete failed: ${(e as Error).message}`
      sections.value = previous
    }
  }

  async function moveSection(gid: string, direction: -1 | 1): Promise<void> {
    const previous = sections.value
    const index = previous.findIndex((s) => s.gid === gid)
    const target = index + direction
    if (index === -1 || target < 0 || target >= previous.length) return
    const list = [...previous]
    const [section] = list.splice(index, 1)
    list.splice(target, 0, section)
    sections.value = list
    try {
      const neighbour = previous[target].gid
      await api.moveSection(project, gid, direction < 0 ? { before_section: neighbour } : { after_section: neighbour })
      persist()
    } catch (e) {
      error.value = `Move failed: ${(e as Error).message}`
      sections.value = previous
    }
  }

  /** Puts a column right before or after another one (drag to reorder). */
  async function placeSection(gid: string, neighbour: string, side: 'before' | 'after'): Promise<void> {
    const previous = sections.value
    const section = previous.find((s) => s.gid === gid)
    if (!section || gid === neighbour) return
    const list = previous.filter((s) => s.gid !== gid)
    const at = list.findIndex((s) => s.gid === neighbour)
    if (at === -1) return
    list.splice(side === 'before' ? at : at + 1, 0, section)
    if (list.every((s, i) => s.gid === previous[i].gid)) return
    sections.value = list
    try {
      await api.moveSection(project, gid, side === 'before' ? { before_section: neighbour } : { after_section: neighbour })
      persist()
    } catch (e) {
      error.value = `Move failed: ${(e as Error).message}`
      sections.value = previous
    }
  }

  /** Moves a card to a position on this board locally, without telling Asana (used after Asana already placed it). */
  function relocate(gid: string, toSection: string, toIndex: number): void {
    const from = locate(gid)
    if (!from) return
    const [card] = column(from.section).cards.splice(from.index, 1)
    const target = column(toSection).cards
    target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, card)
    persist()
  }

  function removeCard(gid: string): void {
    const found = locate(gid)
    if (!found) return
    column(found.section).cards.splice(found.index, 1)
    persist()
  }

  /** Puts a fresh copy of a task on the board. Returns the column it now sits in, if it is on this board. */
  function applyTask(detail: TaskDetail | BoardTask): string | null {
    const membership = detail.memberships.find((m) => m.project.gid === project)
    const section = membership?.section?.gid
    const found = locate(detail.gid)
    // Only what a card shows is kept: descriptions and followers would bloat memory and the cache.
    const {
      notes: _notes,
      html_notes: _html,
      followers: _followers,
      permalink_url: _url,
      memberships: _memberships,
      ...card
    } = detail as TaskDetail

    if (!section || (detail.completed && !showCompleted)) {
      if (found) removeCard(detail.gid)
      return null
    }
    if (found && found.section === section) {
      column(section).cards.splice(found.index, 1, card)
    } else {
      if (found) column(found.section).cards.splice(found.index, 1)
      const target = columns.get(section)
      if (target?.fresh) target.cards.unshift(card)
    }
    persist()
    return section
  }

  /** Re-reads the top of a column so new arrivals and reorders made elsewhere land where Asana has them. */
  async function refreshOrder(section: string): Promise<void> {
    const col = columns.get(section)
    if (!col?.fresh || col.loading) return
    const page = await api.sectionTasks(section, showCompleted, undefined)
    if (pendingWrites) return
    col.cards = mergeFirstPage(col.cards, page.data)
    if (col.cards.length <= page.data.length) col.next = page.next_page?.offset ?? null
    persist()
  }

  async function sync(): Promise<void> {
    if (syncing || pendingWrites || document.visibilityState !== 'visible' || Date.now() < nextSyncAt) return
    syncing = true
    try {
      const result = await api.events(project, syncToken)
      syncToken = result.sync
      syncFailures = 0
      nextSyncAt = 0
      connection.succeeded()
      if (result.reset) {
        await reloadAll()
        return
      }

      const changed = new Set<string>()
      let sectionsChanged = false
      for (const event of result.events) {
        if (event.resource.resource_type === 'section') sectionsChanged = true
        if (event.resource.resource_type !== 'task') continue
        const leftProject = event.action === 'deleted' || (event.action === 'removed' && event.parent?.gid === project)
        if (leftProject) {
          changed.delete(event.resource.gid)
          removeCard(event.resource.gid)
        } else {
          changed.add(event.resource.gid)
        }
      }

      if (sectionsChanged) {
        await refreshSections()
        if (wantAll) await loadAll()
      }
      // Each changed task is re-read in its light form, a few at a time; then every touched column gets its order back.
      const touched = new Set<string>()
      await mapLimit([...changed], 6, async (gid) => {
        const was = locate(gid)?.section
        try {
          const now = pendingWrites ? null : applyTask(await api.boardTask(gid))
          if (was) touched.add(was)
          if (now) touched.add(now)
        } catch (e) {
          if (e instanceof api.AsanaError && e.status === 404) removeCard(gid)
        }
      })
      await mapLimit([...touched], 4, (section) => refreshOrder(section).catch(() => undefined))
    } catch (e) {
      // Quietly back off while Asana is unreachable; one notice comes from the shared connection state.
      syncFailures++
      nextSyncAt = Date.now() + backoffMs(syncFailures - 1, SYNC_INTERVAL_MS, 120_000)
      if (!connection.failed(e)) error.value = `Sync failed: ${(e as Error).message}`
    } finally {
      syncing = false
    }
  }

  async function reloadAll(): Promise<void> {
    await refreshSections()
    const loaded = [...columns.entries()].filter(([, col]) => col.fresh).map(([gid]) => gid)
    for (const col of columns.values()) col.fresh = false
    await mapLimit(loaded, 4, (gid) => ensureColumn(gid))
    // A view that shows every task (list, calendar, grouping) must not silently fall back to the first page.
    if (wantAll) await loadAll()
  }

  function startSync(): void {
    void sync()
    syncTimer = setInterval(() => void sync(), SYNC_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
  }

  function onVisible(): void {
    if (document.visibilityState === 'visible') void sync()
  }

  function dispose(): void {
    clearInterval(syncTimer)
    clearTimeout(persistTimer)
    document.removeEventListener('visibilitychange', onVisible)
  }

  return {
    sections,
    columns,
    error,
    column,
    load,
    ensureColumn,
    loadMore,
    loadAll,
    move,
    addCard,
    addSection,
    renameSection,
    deleteSection,
    moveSection,
    placeSection,
    applyTask,
    setCompleted,
    removeCard,
    relocate,
    reloadAll,
    dispose,
  }
}

export type Board = ReturnType<typeof useBoard>
