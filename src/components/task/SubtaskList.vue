<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as api from '../../api/asana'
import AvatarBadge from '../AvatarBadge.vue'
import { setSubtaskProgress } from '../../composables/useSubtaskProgress'
import DatePicker from '../DatePicker.vue'
import TypeaheadPicker from './TypeaheadPicker.vue'
import { anchorFor, isNoopMove, moveItem } from '../../ordering'
import { useToasts } from '../../composables/useToasts'
import { useBoardContext } from '../../context'
import { hasOpenLayer } from '../../layers'
import type { Subtask } from '../../types'

const props = defineProps<{ parent: string }>()
const emit = defineEmits<{ open: [gid: string]; error: [message: string] }>()

const { me } = useBoardContext()

const toasts = useToasts()
const subtasks = ref<Subtask[]>([])
const loaded = ref(false)
const editing = ref<string | null>(null)
const draft = ref('')
const pending = new Map<string, Promise<string>>()
const resolved = new Map<string, string>()
let queue: Promise<unknown> = Promise.resolve()
let tempCounter = 0
const selected = ref(new Set<string>())
let lastClicked: string | null = null
const dragGid = ref<string | null>(null)
const dropIndex = ref<number | null>(null)
const armed = ref<string | null>(null)

function onDragStart(event: DragEvent, sub: Subtask): void {
  if (armed.value !== sub.gid) {
    event.preventDefault()
    return
  }
  dragGid.value = sub.gid
  event.dataTransfer?.setData('text/plain', sub.gid)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent, index: number): void {
  if (!dragGid.value) return
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndex.value = event.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function onDragEnd(): void {
  dragGid.value = null
  dropIndex.value = null
  armed.value = null
}

async function onDrop(): Promise<void> {
  const gid = dragGid.value
  const target = dropIndex.value
  onDragEnd()
  if (!gid || target === null) return
  const from = subtasks.value.findIndex((t) => t.gid === gid)
  if (from === -1 || isNoopMove(from, target)) return
  const previous = [...subtasks.value]
  const { list, index: to } = moveItem(subtasks.value, from, target)
  subtasks.value = list
  try {
    const anchor = anchorFor(list, to)
    const position = anchor.after
      ? { insert_after: await realGid(anchor.after.gid) }
      : anchor.before
        ? { insert_before: await realGid(anchor.before.gid) }
        : {}
    await api.setParent(await realGid(gid), props.parent, position)
  } catch (e) {
    subtasks.value = previous
    fail(e)
  }
}

/** The name itself: a plain click renames, Ctrl/Shift+click selects. */
function onNameClick(event: MouseEvent, sub: Subtask): void {
  if (event.ctrlKey || event.metaKey || event.shiftKey) selectRow(event, sub)
  else if (editing.value !== sub.gid) startEdit(sub)
}

const vFocus = {
  mounted: (el: HTMLInputElement) => {
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  },
}

const real = computed(() => subtasks.value.filter((s) => !s.is_rendered_as_separator))
const done = computed(() => real.value.filter((s) => s.completed).length)
watch([done, () => real.value.length], ([finished, total]) => {
  if (loaded.value) setSubtaskProgress(props.parent, { done: finished, total })
})

function fail(e: unknown): void {
  emit('error', (e as Error).message)
}

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKey, true)
  try {
    subtasks.value = await api.subtasks(props.parent)
    setSubtaskProgress(props.parent, {
      done: subtasks.value.filter((t) => !t.is_rendered_as_separator && t.completed).length,
      total: subtasks.value.filter((t) => !t.is_rendered_as_separator).length,
    })
  } catch (e) {
    fail(e)
  } finally {
    loaded.value = true
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey, true))

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(
    el &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el.isContentEditable),
  )
}

const rootEl = ref<HTMLElement | null>(null)

/** Keys pressed with focus on the task itself: not in a field, not on a control, not behind a popup, not elsewhere in the app. */
function isPanelKey(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target || hasOpenLayer() || isTyping(target)) return false
  if (target === document.body) return true
  const panel = rootEl.value?.closest('.panel-root')
  if (!panel?.contains(target)) return false
  return !target.closest('button, a, summary, [role="button"], [role="option"], [role="combobox"]')
}

function onGlobalKey(event: KeyboardEvent): void {
  if (!isPanelKey(event) || event.ctrlKey || event.metaKey || event.altKey) return
  if (selected.value.size && (event.key === 'Delete' || event.key === 'Backspace')) {
    event.preventDefault()
    event.stopPropagation()
    deleteSelected()
    return
  }
  if (selected.value.size && event.key === 'Escape') {
    event.stopPropagation()
    selected.value = new Set()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    createAfter(null)
  }
}

/** The row whose name is being edited, if any. */
function editingRow(): Subtask | undefined {
  return subtasks.value.find((s) => s.gid === editing.value)
}

/** Adds a section; while a row is being edited it goes right after that row (or replaces it when still empty). */
function addSection(): void {
  const sub = editingRow()
  if (!sub) return createAfter(null, true)
  const hasName = Boolean(draft.value.trim())
  const index = subtasks.value.indexOf(sub)
  const anchor = hasName ? sub.gid : (subtasks.value[index - 1]?.gid ?? null)
  void commit(sub)
  createAfter(anchor, true)
}

function addSubtask(): void {
  const sub = editingRow()
  if (sub && draft.value.trim()) {
    void commit(sub)
    createAfter(sub.gid)
  } else if (!sub) {
    createAfter(null)
  }
}

/** Assigns the subtask being edited to the current user. False when no subtask name is being edited. */
function assignEditingToMe(): boolean {
  const sub = editingRow()
  if (!sub) return false
  if (!sub.is_rendered_as_separator) void setField(sub, { assignee: me.gid })
  return true
}

defineExpose({ addSection, addSubtask, assignEditingToMe })

/** Anywhere on the row beside the name: a plain click opens the subtask (a section has nothing to open, so it renames). */
function onRowClick(event: MouseEvent, sub: Subtask): void {
  if (event.ctrlKey || event.metaKey || event.shiftKey) selectRow(event, sub)
  else if (editing.value === sub.gid) return
  else if (sub.is_rendered_as_separator) startEdit(sub)
  else void open(sub)
}

function selectRow(event: MouseEvent, sub: Subtask): void {
  const next = new Set(event.ctrlKey || event.metaKey ? selected.value : [])
  if (event.shiftKey && lastClicked) {
    const gids = subtasks.value.map((t) => t.gid)
    const [a, b] = [gids.indexOf(lastClicked), gids.indexOf(sub.gid)].sort((x, y) => x - y)
    for (const gid of gids.slice(a, b + 1)) next.add(gid)
  } else if (next.has(sub.gid)) {
    next.delete(sub.gid)
  } else {
    next.add(sub.gid)
  }
  lastClicked = sub.gid
  selected.value = next
  if (editing.value) void commit(subtasks.value.find((t) => t.gid === editing.value)!)
}

function deleteSelected(): void {
  const rows = subtasks.value.filter((t) => selected.value.has(t.gid))
  if (!rows.length) return
  const before = [...subtasks.value]
  selected.value = new Set()
  subtasks.value = subtasks.value.filter((t) => !rows.includes(t))
  toasts.deferred(
    rows.length > 1 ? `${rows.length} subtasks deleted` : 'Subtask deleted',
    () => {
      for (const row of rows) {
        void realGid(row.gid)
          .then((gid) => api.deleteTask(gid))
          .catch(fail)
      }
    },
    () => {
      const added = subtasks.value.filter((t) => !before.includes(t))
      subtasks.value = [...before.filter((t) => rows.includes(t) || subtasks.value.includes(t)), ...added]
    },
  )
}


function isTemp(gid: string): boolean {
  return gid.startsWith('temp-')
}

function realGid(gid: string): Promise<string> {
  if (!isTemp(gid)) return Promise.resolve(gid)
  const known = resolved.get(gid)
  if (known) return Promise.resolve(known)
  // Neither created nor in flight: creating it failed, so there is no task to talk to Asana about.
  return pending.get(gid) ?? Promise.reject(new Error('This subtask was never created'))
}

function createAfter(afterGid: string | null, section = false): void {
  const anchor = afterGid ?? subtasks.value[subtasks.value.length - 1]?.gid ?? null
  const afterIndex = anchor ? subtasks.value.findIndex((s) => s.gid === anchor) : -1
  const index = afterIndex === -1 ? subtasks.value.length : afterIndex + 1
  const temp = `temp-${++tempCounter}`
  const row: Subtask = { gid: temp, name: '', completed: false, is_rendered_as_separator: section, assignee: null, due_on: null }
  subtasks.value.splice(index, 0, row)
  startEdit(row)

  const job = queue.then(async () => {
    const created = await api.createSubtask(props.parent, section ? 'New section' : 'New subtask', section)
    resolved.set(temp, created.gid)
    if (anchor) {
      try {
        await api.setParent(created.gid, props.parent, { insert_after: await realGid(anchor) })
      } catch (e) {
        fail(e)
      }
    }
    const current = subtasks.value.find((s) => s.gid === temp)
    if (current) current.gid = created.gid
    if (editing.value === temp) editing.value = created.gid
    return created.gid
  })
  pending.set(temp, job)
  queue = job.catch(() => undefined)
  job
    .catch((e) => {
      // Asana never got it: take the row back out instead of leaving a subtask that does not exist.
      subtasks.value = subtasks.value.filter((s) => s.gid !== temp)
      if (editing.value === temp) editing.value = null
      fail(e)
    })
    .finally(() => pending.delete(temp))
}

function startEdit(sub: Subtask): void {
  selected.value = new Set()
  editing.value = sub.gid
  draft.value = sub.name.replace(/:$/, '')
}

async function commit(sub: Subtask): Promise<void> {
  if (editing.value === sub.gid) editing.value = null
  const name = draft.value.trim()
  const previous = sub.name
  if (!name && previous) return deleteWithUndo(sub)
  if (!name) {
    subtasks.value = subtasks.value.filter((s) => s !== sub)
  } else {
    sub.name = name
  }
  let gid: string
  try {
    gid = await realGid(sub.gid)
  } catch {
    return
  }
  try {
    if (!name) await api.deleteTask(gid)
    else if (sub.name !== previous) await api.updateTask(gid, { name: sub.name })
  } catch (e) {
    if (name) sub.name = previous
    fail(e)
  }
}

/** Emptying the name of an existing subtask deletes it, with the same Undo as deleting a selection. */
function deleteWithUndo(sub: Subtask): void {
  const index = subtasks.value.indexOf(sub)
  subtasks.value = subtasks.value.filter((s) => s !== sub)
  toasts.deferred(
    sub.is_rendered_as_separator ? 'Section deleted' : 'Subtask deleted',
    () =>
      void realGid(sub.gid)
        .then((gid) => api.deleteTask(gid))
        .catch(fail),
    () => {
      if (!subtasks.value.includes(sub)) subtasks.value.splice(Math.min(index, subtasks.value.length), 0, sub)
    },
  )
}

function onRowKey(event: KeyboardEvent, sub: Subtask): void {
  // Tab is the shortcut prefix here (Tab+N, Tab+M …); the task panel handles it.
  if (event.key === 'Tab') return
  if (event.key === 'Backspace' && !draft.value) {
    event.preventDefault()
    const index = subtasks.value.indexOf(sub)
    const previous = subtasks.value[index - 1]
    void commit(sub)
    if (previous) startEdit(previous)
    return
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    const direction = event.key === 'ArrowUp' ? -1 : 1
    const index = subtasks.value.indexOf(sub)
    const target = subtasks.value[index + direction]
    void commit(sub)
    if (target) startEdit(target)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const hasName = Boolean(draft.value.trim())
    void commit(sub)
    if (hasName) createAfter(sub.gid)
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    void commit(sub)
  }
}

function onBlur(sub: Subtask): void {
  if (editing.value === sub.gid) void commit(sub)
}

async function toggle(sub: Subtask): Promise<void> {
  sub.completed = !sub.completed
  try {
    await api.updateTask(await realGid(sub.gid), { completed: sub.completed })
  } catch (e) {
    sub.completed = !sub.completed
    fail(e)
  }
}

async function open(sub: Subtask): Promise<void> {
  try {
    emit('open', await realGid(sub.gid))
  } catch (e) {
    fail(e)
  }
}

const assigning = ref<string | null>(null)

async function setField(sub: Subtask, fields: Record<string, unknown>): Promise<void> {
  try {
    const updated = await api.updateTask(await realGid(sub.gid), fields)
    sub.assignee = updated.assignee
    sub.due_on = updated.due_on
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <section v-if="!loaded" class="subtasks" aria-label="Loading subtasks">
    <h3>Subtasks</h3>
    <div v-for="w in [48, 62, 40]" :key="w" class="sk-sub">
      <div class="skeleton" style="height: 18px; width: 18px; border-radius: 50%" />
      <div class="skeleton" :style="{ height: '13px', width: `${w}%` }" />
    </div>
  </section>
  <section v-else ref="rootEl" class="subtasks">
    <h3>
      Subtasks <span v-if="real.length" class="count">{{ done }} / {{ real.length }}</span>
      <span class="hint">Enter adds a subtask · Tab+N adds a section · Tab+M assigns to me</span>
    </h3>
    <ul v-if="subtasks.length">
      <li
        v-for="(sub, index) in subtasks"
        :key="sub.gid"
        :class="{
          separator: sub.is_rendered_as_separator,
          editing: editing === sub.gid,
          selected: selected.has(sub.gid),
          dragging: dragGid === sub.gid,
          'drop-before': dropIndex === index,
          'drop-after': dropIndex === index + 1 && index === subtasks.length - 1,
        }"
        :draggable="armed === sub.gid ? 'true' : 'false'"
        @click="onRowClick($event, sub)"
        @dragstart="onDragStart($event, sub)"
        @dragover="onDragOver($event, index)"
        @drop.prevent="onDrop"
        @dragend="onDragEnd"
      >
        <span
          class="handle"
          title="Drag to reorder · click to select"
          @mousedown="armed = sub.gid"
          @mouseup="armed = null"
          @click.stop="selectRow($event, sub)"
        ><UiIcon name="grip" :size="16" /></span>
        <button
          v-if="!sub.is_rendered_as_separator"
          class="check"
          :class="{ done: sub.completed }"
          :aria-label="sub.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'"
          @click.stop="toggle(sub)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 8.2l2.2 2.2 4.8-4.8" /></svg>
        </button>
        <input
          v-if="editing === sub.gid"
          v-model="draft"
          v-focus
          data-chords
          class="edit"
          :placeholder="sub.is_rendered_as_separator ? 'Section name' : 'Subtask name'"
          @keydown="onRowKey($event, sub)"
          @blur="onBlur(sub)"
          @click.stop
        />
        <span v-else class="name" :class="{ struck: sub.completed }" title="Click to rename · click beside the name to open · Ctrl/Shift+click to select" @click.stop="onNameClick($event, sub)">
          {{ sub.name.replace(/:$/, '') || (sub.is_rendered_as_separator ? 'Untitled section' : 'Untitled subtask') }}
        </span>
        <span v-if="editing !== sub.gid" class="spacer" />
        <template v-if="!sub.is_rendered_as_separator && editing !== sub.gid">
          <span v-if="sub.num_subtasks" class="nested" title="Has subtasks">
            {{ sub.num_subtasks }}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v8a2 2 0 0 0 2 2h6M9 9l3 3-3 3" /></svg>
          </span>
          <span class="inline-fields" :class="{ show: assigning === sub.gid }" @click.stop>
            <span class="field-slot" :class="{ set: sub.due_on }">
              <DatePicker :value="sub.due_on" placeholder="" compact @change="setField(sub, { due_on: $event })" />
            </span>
            <span class="field-slot anchor" :class="{ set: sub.assignee }">
              <button class="assignee" :title="sub.assignee?.name ?? 'Assign'" @click="assigning = sub.gid">
                <AvatarBadge v-if="sub.assignee" :person="sub.assignee" :size="20" />
                <span v-else class="ghost-avatar">+</span>
              </button>
              <TypeaheadPicker
                v-if="assigning === sub.gid"
                type="user"
                placeholder="Assign subtask to…"
                class="right"
                @pick="setField(sub, { assignee: $event.gid }); assigning = null"
                @close="assigning = null"
              />
            </span>
          </span>
          <button class="open" title="Open subtask" aria-label="Open subtask" @click.stop="open(sub)"><UiIcon name="chevron-right" :size="16" /></button>
        </template>
      </li>
    </ul>
    <div v-if="selected.size" class="selection">
      <span>{{ selected.size }} selected</span>
      <button class="danger-btn" @click="deleteSelected">Delete</button>
      <button class="btn-ghost" @click="selected = new Set()">Clear</button>
      <span class="sel-hint">Ctrl / Shift + click selects · Del deletes · drag the handle to reorder</span>
    </div>
    <div class="add-links">
      <button class="add-link" @click="createAfter(null)">+ Add subtask</button>
      <button class="add-link" @click="createAfter(null, true)">+ Add section</button>
    </div>
  </section>
</template>

<style scoped>
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 28px 0 8px;
}
.count {
  font-size: 11px;
  font-weight: 800;
  background: var(--chip);
  padding: 0 6px;
  border-radius: 4px;
  letter-spacing: 0;
}
.hint {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 4px 4px;
  border-bottom: 1px dashed var(--border);
}
li.separator {
  font-weight: 800;
  font-size: 14px;
  color: var(--text-strong);
  margin-top: 10px;
  min-height: 34px;
  border-bottom: 2px solid var(--border-strong);
}
li.separator:first-child {
  margin-top: 0;
}
li.editing {
  border-bottom-color: var(--accent-ring);
}
li.selected {
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
  border-bottom-color: transparent;
}
.selection {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 6px 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
  font-size: 13px;
  font-weight: 700;
}
.selection .btn-ghost {
  font-size: 12px;
  padding: 3px 10px;
}
.danger-btn {
  background: var(--danger);
  color: var(--danger-contrast);
  font-size: 12px;
  padding: 3px 12px;
  border-radius: var(--radius-pill);
}
.sel-hint {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.handle {
  flex: none;
  width: 14px;
  margin-left: -4px;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: -2px;
  cursor: grab;
  opacity: 0;
  user-select: none;
}
li:hover .handle,
li.selected .handle {
  opacity: 0.7;
}
.handle:hover {
  opacity: 1 !important;
}
li.dragging {
  opacity: 0.4;
}
li.drop-before {
  box-shadow: inset 0 2px 0 var(--accent);
}
li.drop-after {
  box-shadow: inset 0 -2px 0 var(--accent);
}
li {
  cursor: default;
}
li:not(.separator):not(.editing) {
  cursor: pointer;
}
li:not(.separator):not(.editing):not(.selected):hover {
  background: color-mix(in srgb, var(--surface-2) 55%, transparent);
}
.spacer {
  flex: 1;
}
/* A wrapping name must not squeeze the controls beside it, or the avatars drift out of their column. */
.handle,
.check,
.nested,
.inline-fields,
.field-slot,
.open {
  flex-shrink: 0;
}
.name {
  min-width: 0;
}
.name {
  flex: 0 1 auto;
  max-width: 100%;
  cursor: text;
  line-height: calc(1.4 * var(--text-scale));
  padding: 3px 6px;
  margin-left: -6px;
  border-radius: 6px;
}
.name:hover {
  background: var(--surface-2);
}
.struck {
  color: var(--muted);
  text-decoration: line-through;
}
.edit {
  flex: 1;
  padding: 4px 8px;
  font-weight: inherit;
  font-size: inherit;
}
.inline-fields {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
}
.field-slot {
  display: inline-flex;
  align-items: center;
  height: 24px;
  opacity: 0;
}
.field-slot :deep(.picker) {
  display: flex;
}
.field-slot :deep(.trigger) {
  height: 24px;
  min-width: 24px;
  padding: 0 4px;
  justify-content: center;
  line-height: 1;
}
.field-slot :deep(.trigger svg) {
  width: 17px;
  height: 17px;
}
.field-slot.set,
li:hover .field-slot,
.inline-fields.show .field-slot,
.field-slot:focus-within {
  opacity: 1;
}
.anchor {
  position: relative;
}
.assignee {
  background: transparent;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  line-height: 1;
}
.ghost-avatar {
  box-sizing: border-box;
  line-height: 1;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px dashed var(--border-strong);
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--muted);
}
.nested {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
.nested svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.open {
  background: transparent;
  color: var(--muted);
  width: 24px;
  height: 24px;
  padding: 0;
  display: grid;
  place-items: center;
  line-height: 1;
  font-size: 16px;
  border-radius: 6px;
}
.open:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
.check {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  background: transparent;
  display: grid;
  place-items: center;
}
.check svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.check:hover {
  border-color: var(--ok);
  background: transparent;
}
.check:hover svg {
  stroke: var(--ok);
}
.check.done {
  background: var(--ok);
  border-color: var(--ok);
  box-shadow: 0 0 10px color-mix(in srgb, var(--ok) 45%, transparent);
}
.check.done svg {
  stroke: var(--ok-contrast);
}
.add-links {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.add-link {
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  padding: 6px 6px;
}
.sk-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
}
.add-link:hover:not(:disabled) {
  color: var(--text);
}
</style>
