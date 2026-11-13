<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as api from '../api/asana'
import BoardColumn from './BoardColumn.vue'
import CalendarGrid from './CalendarGrid.vue'
import QuickEdit from './QuickEdit.vue'
import { useConnection } from '../composables/useConnection'
import type { Column } from '../composables/useBoard'
import { useTaskOpener } from '../composables/useTaskOpener'
import { useToasts } from '../composables/useToasts'
import { readCache, writeCache } from '../cache'
import { readSetting, writeSetting } from '../settings'
import { addDays, toISO, today, dueBucket } from '../dates'
import type { Card, Person, Section, TaskDetail } from '../types'

const props = defineProps<{ me: Person; workspace: string }>()

type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none'
const GROUPS: { key: GroupKey; name: string; due: () => string | null }[] = [
  { key: 'overdue', name: 'Overdue', due: () => toISO(addDays(today(), -1)) },
  { key: 'today', name: 'Today', due: () => toISO(today()) },
  { key: 'tomorrow', name: 'Tomorrow', due: () => toISO(addDays(today(), 1)) },
  { key: 'week', name: 'This week', due: () => toISO(addDays(today(), 7)) },
  { key: 'later', name: 'Later', due: () => toISO(addDays(today(), 14)) },
  { key: 'none', name: 'No due date', due: () => null },
]

const opener = useTaskOpener()
const scroller = ref<HTMLElement | null>(null)
const tasks = ref<Card[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const toasts = useToasts()
watch(error, (message) => {
  if (!message) return
  toasts.error(message)
  error.value = null
})
const query = ref('')
const dragging = ref<string | null>(null)

/** A dropped card is often re-rendered in its new column, so its own dragend never fires; end the drag from the window instead. */
function endDrag(): void {
  setTimeout(() => {
    dragging.value = null
  })
}
onMounted(() => {
  window.addEventListener('drop', endDrag, true)
  window.addEventListener('dragend', endDrag, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('drop', endDrag, true)
  window.removeEventListener('dragend', endDrag, true)
})
const mode = ref<'board' | 'calendar'>(readSetting<'board' | 'calendar'>('my-mode', 'board'))
watch(mode, (value) => writeSetting('my-mode', value))

const filteredTasks = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? tasks.value.filter((t) => t.name.toLowerCase().includes(q)) : tasks.value
})

async function rescheduleTo(gid: string, iso: string): Promise<void> {
  const card = tasks.value.find((t) => t.gid === gid)
  if (!card || card.due_on === iso) return
  const previous = card.due_on
  card.due_on = iso
  try {
    await write(() => api.updateTask(gid, { due_on: iso }))
    toasts.undo('Due date changed', () => {
      card.due_on = previous
      void write(() => api.updateTask(gid, { due_on: previous })).catch((e) => toasts.error((e as Error).message))
    })
  } catch (e) {
    card.due_on = previous
    error.value = (e as Error).message
  }
}

const cacheKey = `my-tasks:${props.workspace}`

function groupOf(card: Card): GroupKey {
  return dueBucket(card.due_on)
}

const grouped = computed(() => {
  const q = query.value.trim().toLowerCase()
  const map = new Map<GroupKey, Card[]>(GROUPS.map((g) => [g.key, []]))
  for (const card of tasks.value) {
    if (q && !card.name.toLowerCase().includes(q)) continue
    map.get(groupOf(card))!.push(card)
  }
  for (const list of map.values()) list.sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'))
  return map
})

function column(key: GroupKey): Column {
  return { cards: grouped.value.get(key) ?? [], next: null, fresh: !loading.value || tasks.value.length > 0, loading: loading.value && !tasks.value.length, error: null }
}

function section(key: GroupKey, name: string): Section {
  return { gid: key, name }
}

/** `quiet` is the background refresh: no cache read, no spinner, no error toast. */
async function load(quiet = false): Promise<void> {
  if (loading.value || refreshing) return
  if (!quiet) {
    const cached = await readCache<Card[]>(cacheKey)
    if (cached) tasks.value = cached
    loading.value = true
  }
  refreshing = true
  try {
    const list = await api.userTaskList(props.workspace)
    tasks.value = await api.myTasks(list)
    void writeCache(cacheKey, tasks.value)
    error.value = null
    connection.succeeded()
  } catch (e) {
    if (!connection.failed(e) && !quiet) error.value = (e as Error).message
  } finally {
    loading.value = false
    refreshing = false
  }
}

// My Tasks keeps itself current: every minute while visible, and when you come back to the tab.
let refreshing = false
const connection = useConnection()
function refreshQuietly(): void {
  if (document.visibilityState === 'visible' && !dragging.value && !pendingWrites) void load(true)
}
let pendingWrites = 0
const refreshTimer = setInterval(refreshQuietly, 60_000)
document.addEventListener('visibilitychange', refreshQuietly)
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', refreshQuietly)
})

/** Runs a change against Asana; a background refresh waits until it has landed. */
async function write<T>(action: () => Promise<T>): Promise<T> {
  pendingWrites++
  try {
    return await action()
  } finally {
    pendingWrites--
    void writeCache(cacheKey, tasks.value)
  }
}

function applyTask(detail: TaskDetail): void {
  const index = tasks.value.findIndex((t) => t.gid === detail.gid)
  const mine = detail.assignee?.gid === props.me.gid && !detail.completed
  const { notes: _n, html_notes: _h, permalink_url: _u, memberships: _m, ...card } = detail
  if (mine && index === -1) tasks.value.push(card)
  else if (mine) tasks.value.splice(index, 1, card)
  else if (index !== -1) tasks.value.splice(index, 1)
  void writeCache(cacheKey, tasks.value)
}

/** Completes tasks (they leave the list) and offers Undo for the ones Asana accepted. */
async function completeMany(gids: string[]): Promise<void> {
  const done: { card: Card; index: number }[] = []
  for (const gid of gids) {
    const index = tasks.value.findIndex((t) => t.gid === gid)
    if (index === -1) continue
    const [card] = tasks.value.splice(index, 1)
    try {
      await write(() => api.updateTask(gid, { completed: true }))
      done.push({ card, index })
    } catch (e) {
      tasks.value.splice(index, 0, card)
      error.value = (e as Error).message
    }
  }
  if (!done.length) return
  toasts.undo(done.length > 1 ? `${done.length} tasks completed` : 'Task completed', () => {
    for (const { card, index } of done.reverse()) {
      if (!tasks.value.some((t) => t.gid === card.gid)) tasks.value.splice(Math.min(index, tasks.value.length), 0, card)
      void write(() => api.updateTask(card.gid, { completed: false })).catch((e) => toasts.error((e as Error).message))
    }
  })
}

function setCompleted(gid: string, completed: boolean): void {
  if (completed) void completeMany([gid])
}

const selected = ref(new Set<string>())
let lastSelected: { group: GroupKey; gid: string } | null = null

function onSelect(group: GroupKey, gid: string, event: MouseEvent): void {
  const next = new Set(selected.value)
  const gids = (grouped.value.get(group) ?? []).map((c) => c.gid)
  if (event.shiftKey && lastSelected?.group === group && gids.includes(lastSelected.gid)) {
    const [a, b] = [gids.indexOf(lastSelected.gid), gids.indexOf(gid)].sort((x, y) => x - y)
    for (const id of gids.slice(a, b + 1)) next.add(id)
  } else if (next.has(gid)) {
    next.delete(gid)
  } else {
    next.add(gid)
  }
  lastSelected = { group, gid }
  selected.value = next
}

function completeSelected(): void {
  const gids = [...selected.value]
  selected.value = new Set()
  void completeMany(gids)
}

const quickEdit = ref<{ gid: string; kind: 'assignee' | 'due'; x: number; y: number } | null>(null)
const quickCard = computed(() => tasks.value.find((t) => t.gid === quickEdit.value?.gid) ?? null)

function openQuick(gid: string, kind: 'assignee' | 'due' | 'field', event: MouseEvent): void {
  // My Tasks spans projects, so there are no project fields to edit here.
  if (kind !== 'field') quickEdit.value = { gid, kind, x: event.clientX, y: event.clientY + 12 }
}

async function saveQuick(changes: Record<string, unknown>): Promise<void> {
  const gid = quickEdit.value?.gid
  quickEdit.value = null
  if (!gid) return
  try {
    applyTask(await write(() => api.updateTask(gid, changes)))
  } catch (e) {
    error.value = (e as Error).message
  }
}

/** Dropping on a column reschedules the card, or every selected card when the dragged one is selected. Undo restores the dates. */
async function onDrop(key: GroupKey): Promise<void> {
  const gid = dragging.value
  dragging.value = null
  const group = GROUPS.find((g) => g.key === key)
  if (!gid || !group) return
  const gids = selected.value.has(gid) && selected.value.size > 1 ? [...selected.value] : [gid]
  selected.value = new Set()
  const due = group.due()
  const moved: { card: Card; previous: string | null }[] = []
  for (const id of gids) {
    const card = tasks.value.find((t) => t.gid === id)
    if (!card || groupOf(card) === key) continue
    const previous = card.due_on
    card.due_on = due
    try {
      await write(() => api.updateTask(id, { due_on: due }))
      moved.push({ card, previous })
    } catch (e) {
      card.due_on = previous
      error.value = (e as Error).message
    }
  }
  if (!moved.length) return
  toasts.undo(moved.length > 1 ? `${moved.length} tasks moved to ${group.name}` : `Moved to ${group.name}`, () => {
    for (const { card, previous } of moved) {
      card.due_on = previous
      void write(() => api.updateTask(card.gid, { due_on: previous })).catch((e) => toasts.error((e as Error).message))
    }
  })
}

async function add(key: GroupKey, name: string): Promise<void> {
  const group = GROUPS.find((g) => g.key === key)
  try {
    tasks.value.unshift(await api.createMyTask(props.workspace, props.me.gid, name, group?.due() ?? null))
  } catch (e) {
    error.value = (e as Error).message
  }
}

onMounted(() => {
  opener.listen(applyTask)
  opener.listenRemoved(removeTask)
  void load()
})
onBeforeUnmount(() => {
  opener.unlisten(applyTask)
  opener.unlistenRemoved(removeTask)
})

function removeTask(gid: string): void {
  tasks.value = tasks.value.filter((t) => t.gid !== gid)
}
</script>

<template>
  <div class="my">
    <header class="head">
      <h1>My Tasks</h1>
      <span class="badge">{{ tasks.length }}</span>
      <div class="modes">
        <button :class="{ on: mode === 'board' }" @click="mode = 'board'">Board</button>
        <button :class="{ on: mode === 'calendar' }" @click="mode = 'calendar'">Calendar</button>
      </div>
      <span class="spacer" />
      <label class="pill search" :class="{ on: query }">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input v-model="query" placeholder="Search my tasks" />
      </label>
      <button class="btn-ghost round" title="Refresh" aria-label="Refresh" :disabled="loading" @click="load()"><UiIcon name="refresh" :size="15" /></button>
    </header>
    <p class="hint">{{ mode === 'board' ? 'Drop a task into a column to reschedule it.' : 'Drag a task to another day to reschedule it.' }}</p>

    <CalendarGrid v-if="mode === 'calendar'" :cards="filteredTasks" @open="opener.open($event)" @reschedule="rescheduleTo" />

    <div v-else ref="scroller" class="columns">
      <BoardColumn
        v-for="(g, index) in GROUPS"
        :key="g.key"
        :section="section(g.key, g.name)"
        :column="column(g.key)"
        :cards="column(g.key).cards"
        :filtered="Boolean(query)"
        :dragging="dragging"
        :root="scroller"
        project=""
        :collapsed="false"
        :first="index === 0"
        :last="index === GROUPS.length - 1"
        hide-menu
        :selected="selected"
        @select="(gid, event) => onSelect(g.key, gid, event)"
        @quick="openQuick"
        @open="opener.open($event)"
        @complete="(gid, done) => setCompleted(gid, done)"
        @add="add(g.key, $event)"
        @dragstart="dragging = $event"
        @dragend="dragging = null"
        @drop="onDrop(g.key)"
      />
    </div>

    <QuickEdit
      v-if="quickEdit && quickCard"
      :key="`${quickEdit.gid}:${quickEdit.kind}`"
      :card="quickCard"
      :kind="quickEdit.kind"
      :field="null"
      :x="quickEdit.x"
      :y="quickEdit.y"
      @close="quickEdit = null"
      @save="saveQuick"
    />

    <div v-if="selected.size" class="selection panel">
      <strong>{{ selected.size }} selected</strong>
      <button class="btn-ghost" @click="completeSelected"><UiIcon name="check" :size="14" /> Complete</button>
      <button class="btn-ghost" @click="selected = new Set()">Clear</button>
      <span class="sel-hint">Ctrl / Shift + click selects · drag any selected card to reschedule all</span>
    </div>
  </div>
</template>

<style scoped>
.selection {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 16px;
  border: 1px solid var(--accent-ring);
  box-shadow: var(--shadow-float), var(--glow);
  font-size: 13px;
  white-space: nowrap;
}
.selection .btn-ghost {
  font-size: 13px;
  padding: 4px 10px;
}
.sel-hint {
  font-size: 11px;
  color: var(--muted);
}
.my {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px 12px;
}
h1 {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
}
.spacer {
  flex: 1;
}
.modes {
  display: flex;
  margin-left: 6px;
  background: var(--surface);
  border-radius: var(--radius-pill);
  padding: 3px;
  box-shadow: var(--shadow-raised);
}
.modes button {
  background: transparent;
  border-radius: var(--radius-pill);
  padding: 4px 13px;
  font-size: 13px;
  color: var(--muted);
}
.modes button.on {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-raised);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  border: 1px solid transparent;
  cursor: text;
}
.pill svg {
  width: 16px;
  height: 16px;
}
.pill.on {
  border-color: var(--accent-ring);
  color: var(--accent);
}
.pill input {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  width: 170px;
  color: var(--text);
  font-weight: 600;
}
.pill input:focus {
  box-shadow: none;
}
.round {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  padding: 0;
  font-size: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-raised);
}
.hint,
.error {
  margin: 0 20px 8px;
  font-size: 12px;
  color: var(--muted);
}
.error {
  color: var(--danger);
  cursor: pointer;
}
.columns {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 4px 20px 20px;
}
</style>
