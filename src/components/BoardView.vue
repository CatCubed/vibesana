<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import * as api from '../api/asana'
import BoardColumn from './BoardColumn.vue'
import CalendarGrid from './CalendarGrid.vue'
import ProjectList from './ProjectList.vue'
import ProjectOverview from './ProjectOverview.vue'
import ProjectIcon from './ProjectIcon.vue'
import PillMenu from './PillMenu.vue'
import SelectMenu from './SelectMenu.vue'
import { useDialog } from '../composables/useDialog'
import QuickEdit from './QuickEdit.vue'
import AvatarBadge from './AvatarBadge.vue'
import TypeaheadPicker from './task/TypeaheadPicker.vue'
import { useBoard, type Column } from '../composables/useBoard'
import { useTaskOpener } from '../composables/useTaskOpener'
import { useToasts } from '../composables/useToasts'
import { useCrossDrag } from '../composables/useCrossDrag'
import { crossDropPosition } from '../ordering'
import { DEFAULT_CARD_PREFS, cardPrefs, setCardPrefs } from '../composables/useSettings'
import { boardContextKey } from '../context'
import { asanaColor, textOn } from '../colors'
import { daysFromToday, isCurrentWeekColumn, nextWeekColumn } from '../dates'
import { readSetting, writeSetting } from '../settings'
import type { Card, FieldDef, Person, Project, TypeaheadResult } from '../types'

const props = withDefaults(
  defineProps<{
    project: Project
    me: Person
    workspace: string
    showCompleted: boolean
    /** In split view only one pane reacts to keyboard shortcuts. */
    active?: boolean
    /** True when two boards are shown side by side. */
    split?: boolean
  }>(),
  { active: true, split: false },
)
const emit = defineEmits<{ activate: []; close: [] }>()
const cross = useCrossDrag()

provide(boardContextKey, { workspace: props.workspace, project: props.project.gid, me: props.me })

type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none'
const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'any', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' },
  { value: 'none', label: 'No due date' },
]

const opener = useTaskOpener()
const toasts = useToasts()
const board = useBoard(props.project.gid, props.showCompleted)
watch(board.error, (message) => {
  if (!message) return
  toasts.error(message)
  board.error.value = null
})

interface Position {
  gid: string
  section: string
  index: number
}

function positionsOf(gids: string[]): Position[] {
  const wanted = new Set(gids)
  const found: Position[] = []
  for (const section of board.sections.value) {
    board.column(section.gid).cards.forEach((card, index) => {
      if (wanted.has(card.gid)) found.push({ gid: card.gid, section: section.gid, index })
    })
  }
  return found
}

async function restorePositions(positions: Position[]): Promise<void> {
  for (const position of positions) await board.move(position.gid, position.section, position.index)
}

function sectionName(gid: string): string {
  return board.sections.value.find((s) => s.gid === gid)?.name ?? 'column'
}

async function completeWithUndo(gids: string[], completed: boolean): Promise<void> {
  const done: string[] = []
  for (const gid of gids) if (await board.setCompleted(gid, completed)) done.push(gid)
  if (!completed || !done.length) return
  toasts.undo(done.length > 1 ? `${done.length} tasks completed` : 'Task completed', () => {
    void (async () => {
      for (const gid of done) {
        try {
          board.applyTask(await api.updateTask(gid, { completed: false }))
        } catch (e) {
          toasts.error((e as Error).message)
        }
      }
    })()
  })
}
const scroller = ref<HTMLElement | null>(null)
const filterInput = ref<HTMLInputElement | null>(null)
/** The filters last used on this project come back with it, without needing a saved view. */
interface StoredFilters {
  assignee: Person | null
  due: DueFilter
  field: { gid: string; options: string[] } | null
}
const storedFilters = readSetting<StoredFilters | null>(`filters:${props.project.gid}`, null)
const query = ref('')
const assignee = ref<Person | null>(storedFilters?.assignee ?? null)
const assigneePicking = ref(false)
const due = ref<DueFilter>(storedFilters?.due ?? 'any')
const fieldFilter = ref<{ gid: string; options: Set<string> } | null>(
  storedFilters?.field ? { gid: storedFilters.field.gid, options: new Set(storedFilters.field.options) } : null,
)
watch(
  [assignee, due, fieldFilter],
  () => {
    const field = fieldFilter.value
    writeSetting(`filters:${props.project.gid}`, {
      assignee: assignee.value ? { ...assignee.value } : null,
      due: due.value,
      field: field ? { gid: field.gid, options: [...field.options] } : null,
    } satisfies StoredFilters)
  },
  { deep: true },
)
const sort = ref<string>(readSetting(`sort:${props.project.gid}`, 'default'))
const fields = ref<FieldDef[]>([])
const dragging = ref<string | null>(null)
const dialog = useDialog()

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
const collapsedKey = `asana-board:collapsed:${props.project.gid}`
const collapsed = ref<Set<string>>(new Set(readCollapsed()))
const addingColumn = ref(false)
const newColumnName = ref('')
const addAnchor = ref<{ gid: string; side: 'before' | 'after' } | undefined>(undefined)

const enumFields = computed(() => fields.value.filter((f) => f.resource_subtype === 'enum' || f.resource_subtype === 'multi_enum'))
const activeField = computed(() => fields.value.find((f) => f.gid === fieldFilter.value?.gid) ?? null)
const prefs = computed(() => cardPrefs(props.project.gid))

type Mode = 'board' | 'list' | 'calendar' | 'overview'
const MODES: { value: Mode; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'overview', label: 'Overview' },
]
const mode = ref<Mode>(readSetting<Mode>(`mode:${props.project.gid}`, 'board'))
const groupBy = ref<string>(readSetting(`group:${props.project.gid}`, 'section'))
const loadingAll = ref(false)
const groupScroller = ref<HTMLElement | null>(null)

const groupFields = computed(() => fields.value.filter((f) => f.resource_subtype === 'enum'))
const groupField = computed(() => groupFields.value.find((f) => f.gid === groupBy.value) ?? null)
/** In split view each pane is always a plain board: no list, calendar or grouping. */
const shownMode = computed<Mode>(() => (props.split ? 'board' : mode.value))
const grouped = computed(() => !props.split && shownMode.value === 'board' && groupField.value !== null)
/** List, calendar and grouping show every task; the overview shows none, so it loads none. */
const needsAll = computed(
  () => !props.split && mode.value !== 'overview' && (mode.value !== 'board' || groupBy.value !== 'section'),
)

async function loadEverything(): Promise<void> {
  if (!needsAll.value || loadingAll.value) return
  loadingAll.value = true
  try {
    await board.loadAll()
  } finally {
    loadingAll.value = false
  }
}

function setMode(value: Mode): void {
  mode.value = value
  writeSetting(`mode:${props.project.gid}`, value)
  void loadEverything()
}

function setGroupBy(value: string): void {
  groupBy.value = value
  writeSetting(`group:${props.project.gid}`, value)
  void loadEverything()
}

const allCards = computed(() => board.sections.value.flatMap((section) => visibleCards(section.gid)))

const groupColumns = computed(() => {
  const field = groupField.value
  if (!field) return []
  const options = [...(field.enum_options ?? []).filter((o) => o.enabled), { gid: 'none', name: `No ${field.name}` }]
  return options.map((option) => {
    const cards = allCards.value.filter((card) => {
      const value = card.custom_fields?.find((f) => f.gid === field.gid)?.enum_value?.gid ?? 'none'
      return value === option.gid
    })
    const column: Column = { cards, next: null, fresh: !loadingAll.value, loading: loadingAll.value && !cards.length, error: null }
    return { section: { gid: option.gid, name: option.name }, column }
  })
})

async function setFieldValue(gids: string[], option: string): Promise<void> {
  const field = groupField.value
  if (!field) return
  const previous = new Map(
    gids.map((gid) => [gid, allCards.value.find((c) => c.gid === gid)?.custom_fields?.find((f) => f.gid === field.gid)?.enum_value?.gid ?? null]),
  )
  const apply = async (gid: string, value: string | null) => {
    try {
      board.applyTask(await api.updateTask(gid, { custom_fields: { [field.gid]: value } }))
    } catch (e) {
      toasts.error((e as Error).message)
    }
  }
  for (const gid of gids) await apply(gid, option === 'none' ? null : option)
  toasts.undo(`${field.name} changed on ${gids.length === 1 ? '1 task' : `${gids.length} tasks`}`, () => {
    void (async () => {
      for (const gid of gids) await apply(gid, previous.get(gid) ?? null)
    })()
  })
}

function onGroupDrop(option: string): void {
  const gid = dragging.value
  dragging.value = null
  if (!gid) return
  const gids = selected.value.has(gid) && selected.value.size > 1 ? [...selected.value] : [gid]
  selected.value = new Set()
  void setFieldValue(gids, option)
}

async function addToGroup(option: string, name: string): Promise<void> {
  const field = groupField.value
  const first = board.sections.value[0]
  if (!field || !first) return
  try {
    board.applyTask(
      await api.createTaskFull({
        name,
        projects: [props.project.gid],
        memberships: [{ project: props.project.gid, section: first.gid }],
        ...(option === 'none' ? {} : { custom_fields: { [field.gid]: option } }),
      }),
    )
  } catch (e) {
    toasts.error((e as Error).message)
  }
}

async function reschedule(gid: string, iso: string): Promise<void> {
  const before = allCards.value.find((c) => c.gid === gid)?.due_on ?? null
  if (before === iso) return
  const apply = async (value: string | null) => {
    try {
      board.applyTask(await api.updateTask(gid, { due_on: value }))
    } catch (e) {
      toasts.error((e as Error).message)
    }
  }
  await apply(iso)
  toasts.undo('Due date changed', () => void apply(before))
}

interface SavedView {
  name: string
  mode: Mode
  groupBy: string
  sort: string
  query: string
  assignee: Person | null
  due: DueFilter
  field: { gid: string; options: string[] } | null
}

const savedViews = ref<SavedView[]>(readSetting<SavedView[]>(`views:${props.project.gid}`, []))

function persistViews(): void {
  writeSetting(`views:${props.project.gid}`, savedViews.value)
}

async function saveView(): Promise<void> {
  const name = await dialog.prompt({
    title: 'Save this view',
    message: 'Keeps the current filters, sort, grouping and layout under a name.',
    placeholder: 'View name',
    confirmLabel: 'Save',
  })
  if (!name) return
  const view: SavedView = {
    name,
    mode: mode.value,
    groupBy: groupBy.value,
    sort: sort.value,
    query: query.value,
    assignee: assignee.value ? { ...assignee.value } : null,
    due: due.value,
    field: fieldFilter.value ? { gid: fieldFilter.value.gid, options: [...fieldFilter.value.options] } : null,
  }
  savedViews.value = [...savedViews.value.filter((v) => v.name !== name), view]
  persistViews()
  toasts.success(`View "${name}" saved`)
}

function applyView(view: SavedView): void {
  query.value = view.query
  assignee.value = view.assignee
  due.value = view.due
  fieldFilter.value = view.field ? { gid: view.field.gid, options: new Set(view.field.options) } : null
  setSort(view.sort)
  groupBy.value = view.groupBy
  writeSetting(`group:${props.project.gid}`, view.groupBy)
  setMode(view.mode)
}

function deleteView(name: string): void {
  savedViews.value = savedViews.value.filter((v) => v.name !== name)
  persistViews()
}
const filtering = computed(
  () => query.value.trim() !== '' || assignee.value !== null || due.value !== 'any' || fieldFilter.value !== null,
)
const filtered = computed(() => filtering.value || sort.value !== 'default')
const loadedCount = computed(() => [...board.columns.values()].reduce((n, c) => n + c.cards.length, 0))
const sortLabel = computed(() => {
  if (sort.value === 'due') return 'Due date'
  if (sort.value === 'name') return 'Name'
  const field = fields.value.find((f) => `field:${f.gid}` === sort.value)
  return field ? field.name : 'Sort'
})

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(collapsedKey) ?? '[]') as string[]
  } catch {
    return []
  }
}

function toggleCollapsed(section: string): void {
  const next = new Set(collapsed.value)
  if (next.has(section)) next.delete(section)
  else next.add(section)
  collapsed.value = next
  try {
    localStorage.setItem(collapsedKey, JSON.stringify([...next]))
  } catch {
    /* storage unavailable */
  }
}

function setSort(value: string): void {
  sort.value = value
  writeSetting(`sort:${props.project.gid}`, value)
}

function pickAssignee(item: TypeaheadResult): void {
  assignee.value = { gid: item.gid, name: item.name, photo: item.photo ?? null }
  assigneePicking.value = false
}

function toggleFieldOption(field: FieldDef, option: string): void {
  const current = fieldFilter.value?.gid === field.gid ? new Set(fieldFilter.value.options) : new Set<string>()
  if (current.has(option)) current.delete(option)
  else current.add(option)
  fieldFilter.value = current.size ? { gid: field.gid, options: current } : null
}

function updatePrefs(patch: Partial<typeof DEFAULT_CARD_PREFS>): void {
  setCardPrefs(props.project.gid, { ...prefs.value, ...patch })
}

function toggleHiddenField(gid: string): void {
  const hidden = new Set(prefs.value.hidden)
  if (hidden.has(gid)) hidden.delete(gid)
  else hidden.add(gid)
  updatePrefs({ hidden: [...hidden] })
}

function matchesDue(card: Card): boolean {
  if (due.value === 'any') return true
  if (due.value === 'none') return !card.due_on
  if (!card.due_on) return false
  const days = daysFromToday(card.due_on)
  if (due.value === 'overdue') return days < 0 && !card.completed
  if (due.value === 'today') return days === 0
  return days >= 0 && days <= 7
}

function matchesField(card: Card): boolean {
  const filter = fieldFilter.value
  if (!filter) return true
  const field = card.custom_fields?.find((f) => f.gid === filter.gid)
  if (!field) return false
  const values = field.enum_value ? [field.enum_value.gid] : (field.multi_enum_values ?? []).map((v) => v.gid)
  return values.some((v) => filter.options.has(v))
}

function fieldRank(card: Card, field: FieldDef): number {
  const value = card.custom_fields?.find((f) => f.gid === field.gid)
  const gid = value?.enum_value?.gid ?? value?.multi_enum_values?.[0]?.gid
  const index = gid ? (field.enum_options ?? []).findIndex((o) => o.gid === gid) : -1
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function sortCards(cards: Card[]): Card[] {
  if (sort.value === 'default') return cards
  const list = [...cards]
  if (sort.value === 'due') {
    list.sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'))
  } else if (sort.value === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    const field = fields.value.find((f) => `field:${f.gid}` === sort.value)
    if (field) list.sort((a, b) => fieldRank(a, field) - fieldRank(b, field))
  }
  return list
}

function visibleCards(section: string): Card[] {
  const cards = board.column(section).cards
  if (!filtered.value) return cards
  const q = query.value.trim().toLowerCase()
  const matched = filtering.value
    ? cards.filter(
        (card) =>
          (!assignee.value || card.assignee?.gid === assignee.value.gid) &&
          matchesDue(card) &&
          matchesField(card) &&
          (!q || card.name.toLowerCase().includes(q) || card.tags.some((t) => t.name.toLowerCase().includes(q))),
      )
    : cards
  return sortCards(matched)
}

function clearFilters(): void {
  query.value = ''
  assignee.value = null
  due.value = 'any'
  fieldFilter.value = null
}

const vSelect = {
  mounted: (el: HTMLInputElement) => {
    el.focus()
    el.select()
  },
}

function startAddColumn(anchor?: { gid: string; side: 'before' | 'after' }): void {
  addAnchor.value = anchor
  const names = board.sections.value.map((section) => section.name)
  const from = anchor ? board.sections.value.find((section) => section.gid === anchor.gid)?.name : undefined
  newColumnName.value = (from && nextWeekColumn(from, names)) || ''
  addingColumn.value = true
}

function submitColumn(): void {
  const name = newColumnName.value.trim()
  addingColumn.value = false
  if (name) void board.addSection(name, addAnchor.value)
}

function saveCollapsed(next: Set<string>): void {
  collapsed.value = next
  try {
    localStorage.setItem(collapsedKey, JSON.stringify([...next]))
  } catch {
    /* storage unavailable */
  }
}

async function collapseEmpty(): Promise<void> {
  await Promise.all(board.sections.value.map((s) => board.ensureColumn(s.gid)))
  const next = new Set(collapsed.value)
  for (const section of board.sections.value) {
    const column = board.column(section.gid)
    if (column.fresh && !column.cards.length) next.add(section.gid)
  }
  saveCollapsed(next)
}


const selected = ref(new Set<string>())
const moving = ref(false)
let lastSelected: { section: string; gid: string } | null = null

function onSelect(section: string, gid: string, event: MouseEvent): void {
  const next = new Set(selected.value)
  if (event.shiftKey && lastSelected?.section === section) {
    const gids = visibleCards(section).map((c) => c.gid)
    const [a, b] = [gids.indexOf(lastSelected.gid), gids.indexOf(gid)].sort((x, y) => x - y)
    if (a !== -1) for (const id of gids.slice(a, b + 1)) next.add(id)
    else next.add(gid)
  } else if (next.has(gid)) {
    next.delete(gid)
  } else {
    next.add(gid)
  }
  lastSelected = { section, gid }
  selected.value = next
}

function orderedSelection(): string[] {
  const ordered: string[] = []
  for (const section of board.sections.value) {
    for (const card of board.column(section.gid).cards) if (selected.value.has(card.gid)) ordered.push(card.gid)
  }
  return ordered
}

async function moveMany(gids: string[], section: string, index: number): Promise<void> {
  moving.value = true
  const before = positionsOf(gids)
  const moved: string[] = []
  try {
    let position = index
    for (const [i, gid] of gids.entries()) {
      if (i > 0) {
        const previous = board.column(section).cards.findIndex((c) => c.gid === gids[i - 1])
        position = previous === -1 ? position : previous + 1
      }
      if (await board.move(gid, section, position)) moved.push(gid)
    }
    if (!moved.length) return
    const restore = before.filter((p) => moved.includes(p.gid))
    const count = moved.length === 1 ? 'Task' : `${moved.length} tasks`
    toasts.undo(`${count} moved to ${sectionName(section)}`, () => void restorePositions(restore))
  } finally {
    moving.value = false
  }
}

function moveSelectedTo(section: string): void {
  if (!section) return
  const gids = orderedSelection()
  selected.value = new Set()
  void moveMany(gids, section, 0)
}

async function completeSelected(): Promise<void> {
  const gids = orderedSelection()
  selected.value = new Set()
  await completeWithUndo(gids, true)
}

/** A card dragged from the other board in split view, or from a board we just switched away from. */
const foreignDrag = computed(() =>
  cross.state.project && cross.state.project !== props.project.gid ? (cross.state.gids[0] ?? null) : null,
)

function startDrag(gid: string): void {
  dragging.value = gid
  const gids = selected.value.has(gid) && selected.value.size > 1 ? orderedSelection() : [gid]
  cross.start(gids, props.project.gid)
}

async function dropFromOtherProject(section: string, index: number, move: boolean): Promise<void> {
  const gids = [...cross.state.gids]
  const source = cross.state.project
  cross.clear()
  if (!gids.length || !source) return
  const target = board.column(section).cards
  const before = target[index]?.gid
  const after = target[index - 1]?.gid
  let previous: string | null = null
  let position = index
  // `added` tells Undo whether this drop put the task into the project, or it was a member already.
  const done: { gid: string; added: boolean }[] = []
  moving.value = true
  try {
    for (const gid of gids) {
      const alreadyHere = positionsOf([gid]).length > 0
      try {
        if (alreadyHere) {
          if (!(await board.move(gid, section, position))) continue
        } else {
          await api.addProject(
            gid,
            props.project.gid,
            crossDropPosition(previous, before, after, section),
          )
        }
        if (move) await api.removeProject(gid, source)
        opener.notify(await api.task(gid))
        if (!alreadyHere) board.relocate(gid, section, position)
        const at = board.column(section).cards.findIndex((c) => c.gid === gid)
        position = at === -1 ? position : at + 1
        previous = gid
        done.push({ gid, added: !alreadyHere })
      } catch (e) {
        toasts.error((e as Error).message)
      }
    }
  } finally {
    moving.value = false
  }
  if (!done.length) return
  const count = done.length === 1 ? 'Task' : `${done.length} tasks`
  toasts.undo(`${count} ${move ? 'moved' : 'added'} to ${props.project.name} · ${sectionName(section)}`, () => {
    void (async () => {
      for (const { gid, added } of done) {
        try {
          if (move) await api.addProject(gid, source)
          if (added) await api.removeProject(gid, props.project.gid)
          opener.notify(await api.task(gid))
        } catch (e) {
          toasts.error((e as Error).message)
        }
      }
    })()
  })
}

function onDrop(section: string, index: number, shift = false): void {
  if (!dragging.value && foreignDrag.value) {
    void dropFromOtherProject(section, index, shift)
    return
  }
  const gid = dragging.value
  dragging.value = null
  cross.clear()
  if (!gid) return
  if (selected.value.has(gid) && selected.value.size > 1) {
    const gids = orderedSelection()
    selected.value = new Set()
    void moveMany(gids, section, index)
  } else {
    const before = positionsOf([gid])
    void board.move(gid, section, index).then((ok) => {
      if (ok && before[0] && before[0].section !== section) {
        toasts.undo(`Moved to ${sectionName(section)}`, () => void restorePositions(before))
      }
    })
  }
}

const focusGid = ref<string | null>(null)
const addRequest = ref<{ section: string; n: number }>({ section: '', n: 0 })
const quickEdit = ref<{ gid: string; kind: 'assignee' | 'due' | 'field'; field: string | null; x: number; y: number } | null>(null)

const quickCard = computed(() => {
  const gid = quickEdit.value?.gid
  if (!gid) return null
  for (const column of board.columns.values()) {
    const card = column.cards.find((c) => c.gid === gid)
    if (card) return card
  }
  return null
})
const quickField = computed(() => fields.value.find((f) => f.gid === quickEdit.value?.field) ?? null)

function openQuick(gid: string, kind: 'assignee' | 'due' | 'field', event: MouseEvent, field?: string): void {
  quickEdit.value = { gid, kind, field: field ?? null, x: event.clientX, y: event.clientY + 12 }
}

async function saveQuick(changes: Record<string, unknown>): Promise<void> {
  const gid = quickEdit.value?.gid
  const keepOpen = quickEdit.value?.kind === 'field' && quickField.value?.resource_subtype === 'multi_enum'
  if (!keepOpen) quickEdit.value = null
  if (!gid) return
  try {
    board.applyTask(await api.updateTask(gid, changes))
  } catch (e) {
    toasts.error((e as Error).message)
  }
}

function locateFocus(): { column: number; index: number } | null {
  const open = board.sections.value.filter((s) => !collapsed.value.has(s.gid))
  for (const [column, section] of open.entries()) {
    const index = visibleCards(section.gid).findIndex((c) => c.gid === focusGid.value)
    if (index !== -1) return { column, index }
  }
  return null
}

function moveFocus(dx: number, dy: number): void {
  const open = board.sections.value.filter((s) => !collapsed.value.has(s.gid))
  if (!open.length) return
  const at = locateFocus()
  if (!at) {
    const first = open.find((s) => visibleCards(s.gid).length)
    focusGid.value = first ? visibleCards(first.gid)[0].gid : null
    return
  }
  let column = at.column
  let index = at.index + dy
  if (dx) {
    do column += dx
    while (column >= 0 && column < open.length && !visibleCards(open[column].gid).length)
    if (column < 0 || column >= open.length) return
  }
  const cards = visibleCards(open[column].gid)
  index = Math.max(0, Math.min(index, cards.length - 1))
  focusGid.value = cards[index]?.gid ?? focusGid.value
}

function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  if (!props.active || typing || event.ctrlKey || event.metaKey || event.altKey || opener.state.gid || quickEdit.value) return
  // The overview has no cards: board shortcuts stay off there, so the arrow keys scroll the page as usual.
  if (shownMode.value === 'overview') return
  const key = event.key
  if (key === '/') {
    event.preventDefault()
    filterInput.value?.focus()
  } else if (key === 'Escape') {
    if (selected.value.size) selected.value = new Set()
    else focusGid.value = null
  } else if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowRight') {
    event.preventDefault()
    moveFocus(key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0, key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0)
  } else if (key === 'n') {
    const at = locateFocus()
    const open = board.sections.value.filter((s) => !collapsed.value.has(s.gid))
    const section = at ? open[at.column] : open[0]
    if (!section) return
    event.preventDefault()
    addRequest.value = { section: section.gid, n: addRequest.value.n + 1 }
  } else if (focusGid.value && locateFocus()) {
    const gid = focusGid.value
    if (key === 'Enter') {
      event.preventDefault()
      opener.open(gid)
    } else if (key === 'c') {
      const card = [...board.columns.values()].flatMap((c) => c.cards).find((c) => c.gid === gid)
      if (card) {
        if (!props.showCompleted && !card.completed) moveFocus(0, 1)
        void completeWithUndo([gid], !card.completed)
      }
    } else if (key === 'x' || key === ' ') {
      event.preventDefault()
      const next = new Set(selected.value)
      if (next.has(gid)) next.delete(gid)
      else next.add(gid)
      selected.value = next
    }
  }
}

function optionStyle(color: string | null): Record<string, string> {
  const hex = asanaColor(color)
  return hex ? { background: hex, color: textOn(hex) } : {}
}

onMounted(() => {
  opener.listen(board.applyTask)
  opener.listenRemoved(board.removeCard)
  void board.load().then(loadEverything)
  void api.projectFields(props.project.gid).then((list) => (fields.value = list))
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  opener.unlisten(board.applyTask)
  opener.unlistenRemoved(board.removeCard)
  board.dispose()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="board" :class="{ split, 'active-pane': split && active }" @mousedown.capture="emit('activate')" @dragenter="emit('activate')">
    <header class="head">
      <ProjectIcon :project="project" :size="30" />
      <h1>{{ project.name }}</h1>
      <span class="badge">{{ loadedCount }}</span>
      <button v-if="split" class="btn-ghost pane-close" title="Close this pane" aria-label="Close this pane" @click.stop="emit('close')">
        <UiIcon name="close" :size="14" />
      </button>

      <div v-if="!split" class="modes">
        <button v-for="m in MODES" :key="m.value" :class="{ on: mode === m.value }" @click="setMode(m.value)">{{ m.label }}</button>
      </div>

      <span class="spacer" />

      <!-- Search, filters, sorting and card options act on tasks; the overview has none. -->
      <template v-if="shownMode !== 'overview'">
      <label class="pill search" :class="{ on: query }">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input ref="filterInput" v-model="query" placeholder="Search tasks" />
        <kbd>/</kbd>
        <button v-if="query" class="clear" title="Clear" aria-label="Clear" @click.prevent="query = ''"><UiIcon name="close" :size="14" /></button>
      </label>

      <div class="assignee-wrap">
        <button class="pill" :class="{ on: assignee }" @click="assigneePicking = !assigneePicking">
          <AvatarBadge v-if="assignee" :person="assignee" :size="18" />
          <svg v-else viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path d="M4 16.5c.8-3 3-4.5 6-4.5s5.2 1.5 6 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          {{ assignee ? (assignee.gid === me.gid ? 'Me' : assignee.name) : 'Assignee' }}
          <span v-if="assignee" class="x" title="Clear" @click.stop="assignee = null"><UiIcon name="close" :size="14" /></span>
        </button>
        <TypeaheadPicker
          v-if="assigneePicking"
          type="user"
          placeholder="Filter by assignee…"
          class="right"
          @pick="pickAssignee"
          @close="assigneePicking = false"
        />
      </div>

      <PillMenu :on="due !== 'any'" @clear="due = 'any'">
        <template #label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          {{ due === 'any' ? 'Due' : DUE_OPTIONS.find((o) => o.value === due)?.label }}
        </template>
        <template #default="{ close }">
          <button v-for="o in DUE_OPTIONS" :key="o.value" class="opt" :class="{ on: due === o.value }" @click="due = o.value; close()">
            {{ o.label }}
          </button>
        </template>
      </PillMenu>

      <PillMenu v-if="enumFields.length" :on="fieldFilter !== null" wide @clear="fieldFilter = null">
        <template #label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 5h14l-5.5 6.5V16l-3 1.5v-7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          </svg>
          {{ activeField ? `${activeField.name} (${fieldFilter?.options.size})` : 'Field' }}
        </template>
        <template v-for="field in enumFields" :key="field.gid">
          <h5 class="eyebrow">{{ field.name }}</h5>
          <label
            v-for="o in (field.enum_options ?? []).filter((x) => x.enabled)"
            :key="o.gid"
            class="opt"
            :class="{ on: fieldFilter?.gid === field.gid && fieldFilter.options.has(o.gid) }"
          >
            <input
              type="checkbox"
              :checked="fieldFilter?.gid === field.gid && fieldFilter.options.has(o.gid)"
              @change="toggleFieldOption(field, o.gid)"
            />
            <span class="chip" :style="optionStyle(o.color)">{{ o.name }}</span>
          </label>
        </template>
      </PillMenu>

      <PillMenu :on="sort !== 'default'" @clear="setSort('default')">
        <template #label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 6h12M6 10h8M8 14h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          {{ sortLabel }}
        </template>
        <template #default="{ close }">
          <button class="opt" :class="{ on: sort === 'default' }" @click="setSort('default'); close()">Asana order</button>
          <button class="opt" :class="{ on: sort === 'due' }" @click="setSort('due'); close()">Due date</button>
          <button class="opt" :class="{ on: sort === 'name' }" @click="setSort('name'); close()">Name</button>
          <template v-if="enumFields.length">
            <div class="sep" />
            <button
              v-for="field in enumFields"
              :key="field.gid"
              class="opt"
              :class="{ on: sort === `field:${field.gid}` }"
              @click="setSort(`field:${field.gid}`); close()"
            >
              {{ field.name }}
            </button>
          </template>
        </template>
      </PillMenu>

      <PillMenu v-if="!split && mode === 'board' && groupFields.length" :on="groupBy !== 'section'" @clear="setGroupBy('section')">
        <template #label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 4h5v12H4zM11 4h5v7h-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          </svg>
          {{ groupField ? `By ${groupField.name}` : 'Group' }}
        </template>
        <template #default="{ close }">
          <button class="opt" :class="{ on: groupBy === 'section' }" @click="setGroupBy('section'); close()">Columns (sections)</button>
          <div class="sep" />
          <button
            v-for="field in groupFields"
            :key="field.gid"
            class="opt"
            :class="{ on: groupBy === field.gid }"
            @click="setGroupBy(field.gid); close()"
          >
            {{ field.name }}
          </button>
        </template>
      </PillMenu>

      <PillMenu v-if="!split" title="Saved views" wide>
        <template #label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M6 3.5h8v13l-4-3-4 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          </svg>
          Views
        </template>
        <template #default="{ close }">
          <div v-for="view in savedViews" :key="view.name" class="saved">
            <button class="opt" @click="applyView(view); close()">{{ view.name }}</button>
            <button class="del" title="Delete this view" aria-label="Delete this view" @click="deleteView(view.name)"><UiIcon name="close" :size="14" /></button>
          </div>
          <p v-if="!savedViews.length" class="menu-note">No saved views yet.</p>
          <div class="sep" />
          <button class="opt" @click="saveView(); close()">+ Save current view…</button>
        </template>
      </PillMenu>

      <PillMenu title="Customize cards" wide>
        <template #label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M6 7.5h8M6 10.5h5M6 13.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          Cards
        </template>
        <h5 class="eyebrow">Show on cards</h5>
        <label class="opt"><input type="checkbox" :checked="prefs.assignee" @change="updatePrefs({ assignee: !prefs.assignee })" /> Assignee</label>
        <label class="opt"><input type="checkbox" :checked="prefs.due" @change="updatePrefs({ due: !prefs.due })" /> Due date</label>
        <label class="opt"><input type="checkbox" :checked="prefs.subtasks" @change="updatePrefs({ subtasks: !prefs.subtasks })" /> Subtask count</label>
        <label class="opt"><input type="checkbox" :checked="prefs.comments !== false" @change="updatePrefs({ comments: prefs.comments === false })" /> Comment count</label>
        <label class="opt"><input type="checkbox" :checked="prefs.parent" @change="updatePrefs({ parent: !prefs.parent })" /> Parent task</label>
        <label class="opt"><input type="checkbox" :checked="prefs.tags" @change="updatePrefs({ tags: !prefs.tags })" /> Tags</label>
        <template v-if="fields.length">
          <h5 class="eyebrow">Custom fields</h5>
          <label v-for="field in fields" :key="field.gid" class="opt">
            <input type="checkbox" :checked="!prefs.hidden.includes(field.gid)" @change="toggleHiddenField(field.gid)" />
            {{ field.name }}
          </label>
        </template>
      </PillMenu>

      <button class="btn-ghost round" title="Reload loaded columns" aria-label="Reload loaded columns" @click="board.reloadAll()"><UiIcon name="refresh" :size="15" /></button>
      </template>
    </header>

    <p v-if="filtered && shownMode === 'board' && !grouped" class="hint">
      Filters and sorting apply to loaded cards; drag &amp; drop is paused.
      <button v-if="filtering" class="link" @click="clearFilters">Clear filters</button>
    </p>

    <ProjectList
      v-if="shownMode === 'list'"
      :sections="board.sections.value"
      :cards-of="visibleCards"
      :fields="fields"
      :hidden="prefs.hidden"
      :sort="sort"
      :loading="loadingAll"
      @open="opener.open($event)"
      @complete="(gid, done) => completeWithUndo([gid], done)"
      @quick="openQuick"
      @sort="setSort"
      @add="(section, name) => board.addCard(section, name)"
    />

    <CalendarGrid v-else-if="shownMode === 'calendar'" :cards="allCards" @open="opener.open($event)" @reschedule="reschedule" />

    <ProjectOverview v-else-if="shownMode === 'overview'" :project="project.gid" />

    <div v-else-if="grouped" ref="groupScroller" class="columns">
      <BoardColumn
        v-for="(group, index) in groupColumns"
        :key="group.section.gid"
        :first="index === 0"
        :last="index === groupColumns.length - 1"
        :section="group.section"
        :column="group.column"
        :cards="group.column.cards"
        :filtered="false"
        :dragging="dragging"
        :root="groupScroller"
        :project="project.gid"
        :collapsed="false"
        hide-menu
        quick-edit
        :focus="focusGid"
        :selected="selected"
        @quick="openQuick"
        @open="opener.open($event)"
        @select="(gid, event) => onSelect(group.section.gid, gid, event)"
        @complete="(gid, done) => completeWithUndo([gid], done)"
        @add="addToGroup(group.section.gid, $event)"
        @dragstart="dragging = $event"
        @dragend="dragging = null"
        @drop="onGroupDrop(group.section.gid)"
      />
    </div>

    <div v-else ref="scroller" class="columns">
      <template v-for="(section, index) in board.sections.value" :key="section.gid">
      <form
        v-if="addingColumn && addAnchor?.gid === section.gid && addAnchor.side === 'before'"
        class="new-column"
        @submit.prevent="submitColumn"
      >
        <input v-model="newColumnName" v-select placeholder="Column name" @keydown.esc="addingColumn = false" @blur="submitColumn" />
      </form>
      <BoardColumn
        :current="isCurrentWeekColumn(section.name)"
        :first="index === 0"
        :last="index === board.sections.value.length - 1"
        :section="section"
        :column="board.column(section.gid)"
        :cards="visibleCards(section.gid)"
        :filtered="filtered"
        :dragging="dragging ?? foreignDrag"
        :root="scroller"
        :project="project.gid"
        :collapsed="collapsed.has(section.gid)"
        quick-edit
        :focus="focusGid"
        :add-request="addRequest.section === section.gid ? addRequest.n : 0"
        @quick="openQuick"
        @visible="board.ensureColumn(section.gid)"
        @more="board.loadMore(section.gid)"
        :selected="selected"
        @open="opener.open($event)"
        @select="(gid, event) => onSelect(section.gid, gid, event)"
        @complete="(gid, done) => completeWithUndo([gid], done)"
        @collapse="toggleCollapsed(section.gid)"
        @add="(name, bottom) => board.addCard(section.gid, name, bottom)"
        @rename="board.renameSection(section.gid, $event)"
        reorderable
        @move="board.moveSection(section.gid, $event)"
        @place="(gid, side) => board.placeSection(gid, section.gid, side)"
        @add-before="startAddColumn({ gid: section.gid, side: 'before' })"
        @add-after="startAddColumn({ gid: section.gid, side: 'after' })"
        @collapse-all="saveCollapsed(new Set(board.sections.value.map((s) => s.gid)))"
        @expand-all="saveCollapsed(new Set())"
        @collapse-empty="collapseEmpty"
        @delete="board.deleteSection(section.gid)"
        @dragstart="startDrag"
        @dragend="dragging = null; cross.clear()"
        @drop="(index, shift) => onDrop(section.gid, index, shift)"
      />
      <form
        v-if="addingColumn && addAnchor?.gid === section.gid && addAnchor.side === 'after'"
        class="new-column"
        @submit.prevent="submitColumn"
      >
        <input v-model="newColumnName" v-select placeholder="Column name" @keydown.esc="addingColumn = false" @blur="submitColumn" />
      </form>
      </template>

      <div class="add-column">
        <form v-if="addingColumn && !addAnchor" @submit.prevent="submitColumn">
          <input v-model="newColumnName" v-select placeholder="Column name" @keydown.esc="addingColumn = false" @blur="submitColumn" />
        </form>
        <button v-else class="btn-ghost add-btn" @click="startAddColumn()">+ Add column</button>
      </div>
    </div>

    <QuickEdit
      v-if="quickEdit && quickCard"
      :key="`${quickEdit.gid}:${quickEdit.kind}:${quickEdit.field}`"
      :card="quickCard"
      :kind="quickEdit.kind"
      :field="quickField"
      :x="quickEdit.x"
      :y="quickEdit.y"
      @close="quickEdit = null"
      @save="saveQuick"
    />

    <div v-if="selected.size || moving" class="selection panel">
      <template v-if="moving">Moving tasks…</template>
      <template v-else>
        <strong>{{ selected.size }} selected</strong>
        <SelectMenu
          compact
          model-value=""
          placeholder="Move to column…"
          label="Move the selected tasks to a column"
          :options="board.sections.value.map((s) => ({ value: s.gid, label: s.name }))"
          @update:model-value="moveSelectedTo"
        />
        <button class="btn-ghost" @click="completeSelected"><UiIcon name="check" :size="14" /> Complete</button>
        <button class="btn-ghost" @click="selected = new Set()">Clear</button>
        <span class="sel-hint">Ctrl / Shift + click or X selects · drag any selected card to move all</span>
      </template>
    </div>

    <div v-else-if="focusGid && shownMode === 'board' && !grouped" class="keys panel">
      <span><kbd>↵</kbd> Open</span>
      <span><kbd>C</kbd> Complete</span>
      <span><kbd>N</kbd> New task here</span>
      <span><kbd>X</kbd> Select</span>
      <span><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> Move</span>
      <span><kbd>Esc</kbd> Done</span>
    </div>
  </div>
</template>

<style scoped>
.pane-close {
  padding: 4px;
  border-radius: 50%;
}
.board.split {
  margin: 4px 2px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.board.split .head {
  padding: 10px 14px 8px;
}
.board.split .columns {
  padding: 4px 14px 14px;
}
.board.split h1 {
  font-size: 18px;
}
.board.split.active-pane {
  border-color: var(--accent);
  box-shadow: var(--glow);
}
.board.split.active-pane h1 {
  color: var(--accent);
}
.board {
  position: relative;
  min-width: 0;
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
  flex-wrap: wrap;
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
  white-space: nowrap;
}
.pill svg {
  width: 16px;
  height: 16px;
}
.pill:hover {
  background: var(--surface);
  color: var(--text-strong);
}
.pill.on {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-ring);
}
.pill .x {
  font-size: 11px;
  opacity: 0.8;
}
.assignee-wrap {
  position: relative;
}
.search {
  cursor: text;
  padding-right: 10px;
}
.search input {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  width: 160px;
  color: var(--text);
  font-weight: 600;
}
.search input:focus {
  box-shadow: none;
}
.search kbd {
  font: 700 10px var(--font);
  font-size-adjust: var(--font-adjust);
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 6px;
}
.clear {
  background: transparent;
  padding: 0 4px;
  font-size: 11px;
  color: var(--muted);
}
.chip {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 5px;
  background: var(--chip);
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
.hint .link {
  background: transparent;
  color: var(--accent);
  padding: 0 4px;
  font-size: 12px;
}
.new-column {
  flex: 0 0 var(--column-width);
  align-self: flex-start;
  padding: 12px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent-ring);
  box-shadow: var(--shadow-raised), var(--glow);
}
.new-column input {
  width: 100%;
  font-weight: 800;
}
.add-column {
  flex: 0 0 240px;
  padding-top: 4px;
}
.add-btn {
  width: 100%;
  padding: 10px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  font-weight: 700;
}
.add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.add-column input {
  width: 100%;
}
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
.keys {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border: 1px solid var(--accent-ring);
  box-shadow: var(--shadow-float), var(--glow);
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
}
.keys span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.keys kbd {
  font: 800 11px var(--font);
  font-size-adjust: var(--font-adjust);
  color: var(--text-strong);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 1px 6px;
  min-width: 20px;
  text-align: center;
}
.selection .btn-ghost {
  font-size: 13px;
  padding: 4px 10px;
}
.sel-hint {
  font-size: 11px;
  color: var(--muted);
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
.saved {
  display: flex;
  align-items: center;
}
.saved .del {
  flex: none;
  background: transparent;
  color: var(--muted);
  padding: 4px 8px;
  font-size: 11px;
}
.saved .del:hover {
  color: var(--danger);
}
.menu-note {
  margin: 4px 10px;
  font-size: 12px;
  color: var(--muted);
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
