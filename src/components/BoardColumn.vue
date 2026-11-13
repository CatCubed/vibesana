<script setup lang="ts">
import { useDialog } from '../composables/useDialog'
import { useColumnDrag } from '../composables/useColumnDrag'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import TaskCard from './TaskCard.vue'
import { useClickOutside } from '../composables/useClickOutside'
import type { Column } from '../composables/useBoard'
import type { Card, Section } from '../types'

const props = defineProps<{
  section: Section
  column: Column
  cards: Card[]
  filtered: boolean
  /** Section columns of a project can be dragged by their header to change their order. */
  reorderable?: boolean
  dragging: string | null
  root: HTMLElement | null
  project: string
  collapsed: boolean
  first: boolean
  last: boolean
  hideMenu?: boolean
  /** Marks the column for the week we are in. */
  current?: boolean
  selected?: Set<string>
  quickEdit?: boolean
  focus?: string | null
  addRequest?: number
}>()

const emit = defineEmits<{
  visible: []
  more: []
  open: [gid: string]
  select: [gid: string, event: MouseEvent]
  quick: [gid: string, kind: 'assignee' | 'due' | 'field', event: MouseEvent, field?: string]
  complete: [gid: string, completed: boolean]
  collapse: []
  add: [name: string, bottom: boolean]
  rename: [name: string]
  move: [direction: -1 | 1]
  'add-before': []
  'add-after': []
  'collapse-all': []
  'expand-all': []
  'collapse-empty': []
  delete: []
  dragstart: [gid: string]
  dragend: []
  drop: [index: number, shift: boolean]
  /** A dragged column was dropped on this one: put it before or after. */
  place: [gid: string, side: 'before' | 'after']
}>()

const columnDrag = useColumnDrag()
const placeSide = ref<'before' | 'after' | null>(null)

function onHeaderDragStart(event: DragEvent): void {
  if (!props.reorderable || renaming.value) {
    event.preventDefault()
    return
  }
  event.dataTransfer?.setData('text/plain', props.section.gid)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  columnDrag.start(props.section.gid, props.project)
}

function onColumnDragOver(event: DragEvent): void {
  const { gid, project } = columnDrag.state
  if (!props.reorderable || !gid || project !== props.project || gid === props.section.gid) return
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  placeSide.value = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
}

function onColumnDragLeave(event: DragEvent): void {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) placeSide.value = null
}

function onColumnDrop(event: DragEvent): void {
  const gid = columnDrag.state.gid
  const side = placeSide.value
  placeSide.value = null
  if (!gid || !side) return
  event.preventDefault()
  columnDrag.clear()
  emit('place', gid, side)
}
watch(
  () => columnDrag.state.gid,
  (gid) => {
    if (!gid) placeSide.value = null
  },
)

const columnEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const seen = ref(false)
const dropIndex = ref<number | null>(null)
const adding = ref(false)
const newName = ref('')
const menuEl = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const renaming = ref(false)
const renameValue = ref('')

useClickOutside(menuEl, () => (menuOpen.value = false))

function startRename(): void {
  menuOpen.value = false
  renameValue.value = props.section.name
  renaming.value = true
}

function submitRename(): void {
  const value = renameValue.value.trim()
  renaming.value = false
  if (value && value !== props.section.name) emit('rename', value)
}

/** Empty for real: every task of the column is loaded and none is merely hidden by a filter or as completed. */
const deletable = computed(() => props.column.cards.length === 0 && !props.column.next && props.column.fresh !== false)

async function confirmDelete(): Promise<void> {
  menuOpen.value = false
  if (!deletable.value) return
  const sure = await useDialog().confirm({ title: `Delete column "${props.section.name}"?`, confirmLabel: 'Delete', danger: true })
  if (sure) emit('delete')
}

const draggedIndex = computed(() => (props.dragging ? props.cards.findIndex((c) => c.gid === props.dragging) : -1))
function isGhost(gid: string | undefined): boolean {
  if (!gid || !props.dragging) return false
  return gid === props.dragging || Boolean(props.selected?.has(props.dragging) && props.selected.has(gid))
}

const openCount = computed(() => props.cards.filter((c) => !c.completed).length)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.cards.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: () => 80,
    gap: 8,
    overscan: 6,
    getItemKey: (index: number) => props.cards[index]?.gid ?? index,
    rangeExtractor: (range: { startIndex: number; endIndex: number; overscan: number; count: number }) => {
      const start = Math.max(0, range.startIndex - range.overscan)
      const end = Math.min(range.count - 1, range.endIndex + range.overscan)
      const indexes = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      if (draggedIndex.value >= 0 && !indexes.includes(draggedIndex.value)) indexes.push(draggedIndex.value)
      return indexes.sort((a, b) => a - b)
    },
  })),
)

const items = computed(() => virtualizer.value.getVirtualItems())

watch(
  () => props.focus,
  (gid) => {
    if (!gid) return
    const index = props.cards.findIndex((c) => c.gid === gid)
    if (index === -1) return
    virtualizer.value.scrollToIndex(index, { align: 'auto' })
    columnEl.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
)

watch(
  () => props.addRequest,
  (value) => {
    if (value) adding.value = true
  },
)

watch(items, (list) => {
  const last = list[list.length - 1]
  if (last && last.index >= props.cards.length - 8 && props.column.next && !props.filtered) emit('more')
})

let observer: IntersectionObserver | undefined
let intersecting = false

function reveal(): void {
  if (!intersecting || props.collapsed) return
  seen.value = true
  emit('visible')
}

watch(() => props.collapsed, reveal)

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      intersecting = entries.some((e) => e.isIntersecting)
      reveal()
    },
    { root: props.root, rootMargin: '0px 300px' },
  )
  if (columnEl.value) observer.observe(columnEl.value)
})
onBeforeUnmount(() => observer?.disconnect())

function measure(el: unknown): void {
  if (el instanceof Element) virtualizer.value.measureElement(el)
}

function indexAt(event: DragEvent): number {
  const el = scrollEl.value
  if (!el) return 0
  const offset = event.clientY - el.getBoundingClientRect().top + el.scrollTop
  for (const item of items.value) {
    if (offset < item.start + item.size / 2) return item.index
  }
  const last = items.value[items.value.length - 1]
  return last ? last.index + 1 : 0
}

function onDragOver(event: DragEvent): void {
  if (!props.dragging) return
  event.preventDefault()
  dropIndex.value = props.collapsed ? 0 : indexAt(event)
}

/** The pointer left this column for real, not just moved onto one of its cards. */
function onDragLeave(event: DragEvent): void {
  const zone = event.currentTarget as HTMLElement
  const next = event.relatedTarget as Node | null
  if (!next || !zone.contains(next)) dropIndex.value = null
}

// Whatever happened to the drag (dropped elsewhere, cancelled, source card gone), no column keeps its insertion line.
watch(
  () => props.dragging,
  (gid) => {
    if (!gid) dropIndex.value = null
  },
)

/**
 * With a filter or sort on, the column shows only some cards, in another order. A drop then means
 * "before the card I dropped it on" (or after the last one shown), translated to the column's real order.
 */
function realIndex(shown: number): number {
  if (!props.filtered) return shown
  const all = props.column.cards
  const target = props.cards[shown]
  if (target) return Math.max(0, all.indexOf(target))
  const last = props.cards[props.cards.length - 1]
  return last ? all.indexOf(last) + 1 : 0
}

function onDrop(event: DragEvent): void {
  if (dropIndex.value === null) return
  event.preventDefault()
  emit('drop', realIndex(dropIndex.value), event.shiftKey)
  dropIndex.value = null
}

const indicatorTop = computed(() => {
  if (dropIndex.value === null) return 0
  const item = items.value.find((i) => i.index === dropIndex.value)
  if (item) return item.start - 5
  const last = items.value[items.value.length - 1]
  return last ? last.end + 3 : 0
})

function onDragStart(event: DragEvent, gid: string): void {
  event.dataTransfer?.setData('text/plain', gid)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('dragstart', gid)
}

function submitNew(): void {
  const name = newName.value.trim()
  if (name) emit('add', name, false)
  newName.value = ''
  adding.value = false
}

const addingBottom = ref(false)
const bottomName = ref('')

function submitBottom(keepOpen: boolean): void {
  const name = bottomName.value.trim()
  bottomName.value = ''
  if (name) emit('add', name, true)
  if (!name || !keepOpen) addingBottom.value = false
}
</script>

<template>
  <section
    v-if="collapsed"
    ref="columnEl"
    class="column collapsed"
    :class="{ target: dropIndex !== null, current, 'place-before': placeSide === 'before', 'place-after': placeSide === 'after' }"
    title="Expand column"
    :draggable="reorderable"
    @click="emit('collapse')"
    @dragstart="onHeaderDragStart"
    @dragover="onDragOver($event); onColumnDragOver($event)"
    @dragleave="onDragLeave($event); onColumnDragLeave($event)"
    @drop="columnDrag.state.gid ? onColumnDrop($event) : onDrop($event)"
  >
    <span class="badge">{{ openCount || '' }}</span>
    <h2>{{ section.name }}</h2>
  </section>

  <section
    v-else
    ref="columnEl"
    class="column"
    :class="{ target: dropIndex !== null, current, 'place-before': placeSide === 'before', 'place-after': placeSide === 'after' }"
    @dragover="onColumnDragOver"
    @dragleave="onColumnDragLeave"
    @drop="onColumnDrop"
  >
    <header :draggable="reorderable && !renaming" :class="{ grabbable: reorderable }" @dragstart="onHeaderDragStart">
      <input
        v-if="renaming"
        v-model="renameValue"
        class="rename"
        autofocus
        @keydown.enter="submitRename"
        @keydown.esc="renaming = false"
        @blur="submitRename"
      />
      <h2 v-else :title="section.name" @dblclick="startRename">{{ section.name }}</h2>
      <span v-if="current && !renaming" class="now" title="This is the current week">This week</span>
      <span v-if="!renaming" class="badge" :class="{ lit: openCount }">{{ openCount }}{{ column.next ? '+' : '' }}</span>
      <span class="spacer" />
      <button class="btn-ghost icon" title="Add task" @click="adding = true">+</button>
      <div v-if="!hideMenu" ref="menuEl" class="menu-anchor">
        <button class="btn-ghost icon" title="Column options" @click="menuOpen = !menuOpen">⋯</button>
        <div v-if="menuOpen" class="menu panel">
          <button @click="startRename">Rename</button>
          <button @click="emit('add-before'); menuOpen = false">← Add column to left</button>
          <button @click="emit('add-after'); menuOpen = false">→ Add column to right</button>
          <hr />
          <button @click="emit('collapse'); menuOpen = false">Collapse this column</button>
          <button @click="emit('collapse-all'); menuOpen = false">Collapse all columns</button>
          <button @click="emit('expand-all'); menuOpen = false">Expand all columns</button>
          <button @click="emit('collapse-empty'); menuOpen = false">Collapse empty columns</button>
          <hr />
          <button :disabled="first" @click="emit('move', -1); menuOpen = false">Move left</button>
          <button :disabled="last" @click="emit('move', 1); menuOpen = false">Move right</button>
          <hr />
          <button
            class="danger"
            :disabled="!deletable"
            :title="deletable ? '' : 'Only empty columns can be deleted (tasks hidden by a filter or not loaded yet count too)'"
            @click="confirmDelete"
          >
            Delete column
          </button>
        </div>
      </div>
    </header>

    <form v-if="adding" class="new" @submit.prevent="submitNew">
      <input v-model="newName" placeholder="Task name" autofocus @keydown.esc="adding = false" @blur="submitNew" />
    </form>

    <div
      ref="scrollEl"
      class="scroll"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div v-if="seen" class="inner" :style="{ height: `${virtualizer.getTotalSize()}px` }">
        <div
          v-for="item in items"
          :key="String(item.key)"
          :ref="measure"
          :data-index="item.index"
          class="row"
          :class="{ ghost: isGhost(cards[item.index]?.gid) }"
          :style="{ transform: `translateY(${item.start}px)` }"
        >
          <TaskCard
            v-if="cards[item.index]"
            :card="cards[item.index]"
            :draggable="true"
            :project="project"
            :selected="selected?.has(cards[item.index].gid)"
            :focused="focus === cards[item.index].gid"
            :quick-edit="quickEdit"
            @quick="(kind, event, field) => emit('quick', cards[item.index].gid, kind, event, field)"
            @open="emit('open', $event)"
            @select="emit('select', cards[item.index].gid, $event)"
            @complete="emit('complete', cards[item.index].gid, $event)"
            @dragstart="onDragStart($event, cards[item.index].gid)"
            @dragend="emit('dragend'); dropIndex = null"
          />
        </div>
        <div v-if="dropIndex !== null" class="indicator" :style="{ top: `${indicatorTop}px` }" />
      </div>
      <template v-if="seen && column.fresh && !column.next && !filtered">
        <input
          v-if="addingBottom"
          v-model="bottomName"
          class="bottom-input"
          placeholder="Task name, Enter adds another"
          autofocus
          @keydown.enter="submitBottom(true)"
          @keydown.esc="addingBottom = false"
          @blur="submitBottom(false)"
        />
        <button v-else class="btn-ghost add-bottom" @click="addingBottom = true">+ Add task</button>
      </template>
      <div v-if="column.loading && !cards.length" class="sk-cards" aria-label="Loading tasks">
        <div v-for="n in 3" :key="n" class="sk-card">
          <div class="skeleton" :style="{ height: '13px', width: `${[82, 64, 74][n - 1]}%` }" />
          <div class="sk-chips">
            <div class="skeleton" style="height: 16px; width: 34px" />
            <div class="skeleton" style="height: 16px; width: 52px" />
            <div class="skeleton" style="height: 16px; width: 44px" />
          </div>
          <div class="skeleton" style="height: 22px; width: 22px; border-radius: 50%" />
        </div>
      </div>
      <p v-else-if="column.loading" class="status">Loading more…</p>
      <p v-else-if="column.error" class="status error">{{ column.error }}</p>
      <p v-else-if="seen && column.fresh && !cards.length" class="status">Nothing here</p>
    </div>
  </section>
</template>

<style scoped>
.column {
  flex: 0 0 var(--column-width);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-raised);
  border: 1px solid transparent;
  transition: box-shadow 0.12s, border-color 0.12s;
}
.now {
  flex: none;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 9px color-mix(in srgb, var(--accent) 22%, transparent);
}
:root[data-glow='off'] .now {
  box-shadow: none;
}
/* Where a dragged column will land. */
.column.place-before {
  box-shadow: -4px 0 0 -1px var(--accent), var(--shadow-raised);
}
.column.place-after {
  box-shadow: 4px 0 0 -1px var(--accent), var(--shadow-raised);
}
header.grabbable {
  cursor: grab;
}
.column.target {
  border-color: var(--accent-ring);
  box-shadow: var(--shadow-raised), var(--glow);
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px 8px 16px;
}
h2 {
  font-size: 14px;
  font-weight: 800;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.badge.lit {
  background: var(--accent-soft);
  color: var(--accent);
}
.spacer {
  flex: 1;
}
.icon {
  padding: 0 7px;
  font-size: 17px;
  line-height: 24px;
}
.rename {
  flex: 1;
  padding: 4px 8px;
  font-weight: 800;
}
.menu-anchor {
  position: relative;
}
.menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  right: 0;
  min-width: 210px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
.menu button {
  text-align: left;
  background: transparent;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.menu button:hover:not(:disabled) {
  background: var(--chip);
}
.menu hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 4px 0;
}
.menu .danger {
  color: var(--danger);
}
.new {
  padding: 0 10px 8px;
}
.new input {
  width: 100%;
}
.scroll {
  flex: 1;
  min-height: 80px;
  overflow-y: auto;
  padding: 2px 10px 14px;
}
.inner {
  position: relative;
  width: 100%;
}
.row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
.row.ghost {
  opacity: 0.35;
}
.indicator {
  position: absolute;
  left: 4px;
  right: 4px;
  height: 3px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: var(--glow);
  pointer-events: none;
}
.add-bottom {
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  font-size: 13px;
  text-align: left;
}
.bottom-input {
  width: 100%;
  margin-top: 8px;
}
.sk-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: var(--pad) calc(var(--pad) + 2px);
  margin-bottom: 8px;
  box-shadow: var(--shadow-raised);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sk-chips {
  display: flex;
  gap: 4px;
}
.status {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  margin: 14px 0;
}
.status.error {
  color: var(--danger);
}
.column.collapsed {
  flex: 0 0 44px;
  align-items: center;
  padding: 12px 0;
  gap: 10px;
  cursor: pointer;
}
.column.collapsed h2 {
  writing-mode: vertical-rl;
  white-space: nowrap;
  color: var(--muted);
}
.column.collapsed:hover h2 {
  color: var(--text-strong);
}
</style>
