<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, ref } from 'vue'
import { asanaColor, textOn } from '../colors'
import { daysFromToday, formatDay } from '../dates'
import AvatarBadge from './AvatarBadge.vue'
import { useTaskOpener } from '../composables/useTaskOpener'
import type { Card, Colored, FieldDef, Section } from '../types'

const props = defineProps<{
  sections: Section[]
  cardsOf: (section: string) => Card[]
  fields: FieldDef[]
  hidden: string[]
  sort: string
  loading: boolean
}>()

const emit = defineEmits<{
  open: [gid: string]
  complete: [gid: string, completed: boolean]
  quick: [gid: string, kind: 'assignee' | 'due' | 'field', event: MouseEvent, field?: string]
  sort: [value: string]
  add: [section: string, name: string]
}>()

const opener = useTaskOpener()
const collapsed = ref(new Set<string>())
const addingIn = ref<string | null>(null)
const newName = ref('')

/** Filtering and sorting run once per section per change, not once for the badge and again for the rows. */
const cardsBySection = computed(() => new Map(props.sections.map((s) => [s.gid, props.cardsOf(s.gid)])))

const columns = computed(() => props.fields.filter((f) => !props.hidden.includes(f.gid)))
// The name keeps at least 220px and takes what is left; the other columns shrink (down to a floor) so the
// whole table fits the width instead of scrolling sideways.
const template = computed(
  () => `minmax(220px, 1fr) minmax(96px, 170px) minmax(84px, 110px) ${columns.value.map(() => 'minmax(72px, 150px)').join(' ')}`,
)

function toggle(gid: string): void {
  const next = new Set(collapsed.value)
  if (next.has(gid)) next.delete(gid)
  else next.add(gid)
  collapsed.value = next
}

function values(card: Card, field: FieldDef): Colored[] {
  const value = card.custom_fields?.find((f) => f.gid === field.gid)
  if (!value) return []
  if (value.enum_value) return [value.enum_value]
  return value.multi_enum_values ?? []
}

function text(card: Card, field: FieldDef): string {
  return card.custom_fields?.find((f) => f.gid === field.gid)?.display_value ?? ''
}

function isEnum(field: FieldDef): boolean {
  return field.resource_subtype === 'enum' || field.resource_subtype === 'multi_enum'
}

function chipStyle(color: string | null): Record<string, string> {
  const hex = asanaColor(color)
  return hex ? { background: hex, color: textOn(hex) } : {}
}

function submit(section: string): void {
  const name = newName.value.trim()
  newName.value = ''
  if (name) emit('add', section, name)
  else addingIn.value = null
}

function sortBy(value: string): void {
  emit('sort', props.sort === value ? 'default' : value)
}
</script>

<template>
  <div class="list">
    <div class="table">
      <div class="row head" :style="{ gridTemplateColumns: template }">
        <button class="th" :class="{ on: sort === 'name' }" @click="sortBy('name')">Task name</button>
        <span class="th plain">Assignee</span>
        <button class="th" :class="{ on: sort === 'due' }" @click="sortBy('due')">Due date</button>
        <button
          v-for="field in columns"
          :key="field.gid"
          class="th"
          :class="{ on: sort === `field:${field.gid}`, plain: !isEnum(field) }"
          :disabled="!isEnum(field)"
          @click="sortBy(`field:${field.gid}`)"
        >
          {{ field.name }}
        </button>
      </div>

      <section v-for="section in sections" :key="section.gid" class="group">
        <header @click="toggle(section.gid)">
          <span class="caret"><UiIcon :name="collapsed.has(section.gid) ? 'chevron-right' : 'chevron-down'" :size="13" /></span>
          <strong>{{ section.name }}</strong>
          <span class="badge">{{ cardsBySection.get(section.gid)?.length ?? 0 }}</span>
        </header>
        <template v-if="!collapsed.has(section.gid)">
          <div
            v-for="card in cardsBySection.get(section.gid) ?? []"
            :key="card.gid"
            class="row"
            :class="{ done: card.completed, opened: opener.state.gid === card.gid }"
            :style="{ gridTemplateColumns: template }"
            @click="emit('open', card.gid)"
          >
            <div class="cell name">
              <button
                class="check"
                :class="{ done: card.completed }"
                :title="card.completed ? 'Mark incomplete' : 'Mark complete'"
                @click.stop="emit('complete', card.gid, !card.completed)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 8.2l2.2 2.2 4.8-4.8" /></svg>
              </button>
              <span class="title">{{ card.name || 'Untitled task' }}</span>
              <span v-if="card.num_subtasks" class="sub">{{ card.num_subtasks }} ⑂</span>
            </div>
            <div class="cell edit" @click.stop="emit('quick', card.gid, 'assignee', $event)">
              <template v-if="card.assignee">
                <AvatarBadge :person="card.assignee" :size="20" />
                <span class="ellipsis">{{ card.assignee.name }}</span>
              </template>
              <span v-else class="empty">—</span>
            </div>
            <div
              class="cell edit"
              :class="{ overdue: card.due_on && !card.completed && daysFromToday(card.due_on) < 0 }"
              @click.stop="emit('quick', card.gid, 'due', $event)"
            >
              <span v-if="card.due_on">{{ formatDay(card.due_on) }}</span>
              <span v-else class="empty">—</span>
            </div>
            <div
              v-for="field in columns"
              :key="field.gid"
              class="cell"
              :class="{ edit: isEnum(field) }"
              @click="isEnum(field) ? ($event.stopPropagation(), emit('quick', card.gid, 'field', $event, field.gid)) : undefined"
            >
              <template v-if="isEnum(field)">
                <span v-for="v in values(card, field)" :key="v.gid" class="chip" :style="chipStyle(v.color)">{{ v.name }}</span>
                <span v-if="!values(card, field).length" class="empty">—</span>
              </template>
              <span v-else class="ellipsis muted">{{ text(card, field) || '—' }}</span>
            </div>
          </div>
          <div class="add">
            <input
              v-if="addingIn === section.gid"
              v-model="newName"
              placeholder="Task name, Enter adds another"
              autofocus
              @keydown.enter="submit(section.gid)"
              @keydown.esc="addingIn = null"
              @blur="submit(section.gid)"
            />
            <button v-else class="btn-ghost" @click.stop="addingIn = section.gid">+ Add task</button>
          </div>
        </template>
      </section>
      <p v-if="loading" class="status">Loading all tasks…</p>
    </div>
  </div>
</template>

<style scoped>
/* The scrolling box starts exactly at the table's top edge and shares its rounded corners, so rows that
   scroll under the sticky header cannot show above it or around its corners. */
.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 4px 20px 0;
  padding: 0 0 24px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.table {
  /* Only when even the narrowest columns do not fit (a very small window) does the list scroll sideways. */
  min-width: min-content;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-raised);
  padding: 0 0 8px;
}
.row {
  display: grid;
  align-items: center;
  min-height: 38px;
  border-bottom: 1px dashed var(--border);
  cursor: pointer;
  content-visibility: auto;
  contain-intrinsic-size: auto 38px;
}
.row:hover:not(.head) {
  background: var(--surface-2);
}
.row.opened,
.row.opened:hover {
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}
.row.head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--surface);
  border-bottom: 1px solid var(--border-strong);
  cursor: default;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  /* Always rendered at its real height: the off-screen row optimisation must not apply to the header. */
  content-visibility: visible;
  align-items: stretch;
  overflow: hidden;
}
.th {
  min-width: 0;
  text-align: left;
  background: transparent;
  border-radius: 0;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.th.on {
  color: var(--accent);
}
/* Lines up with the task names, which sit after the check mark's indent. */
/* Buttons centre their label on their own; the one plain label needs help. */
span.th {
  display: flex;
  align-items: center;
}
.th:first-child {
  padding-left: 20px;
}
.th.on::after {
  content: ' ↓';
}
.th.plain {
  cursor: default;
  opacity: 1;
}
.group > header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 12px 6px;
  cursor: pointer;
  position: sticky;
  left: 0;
}
.group > header strong {
  font-size: 14px;
  color: var(--text-strong);
}
.caret {
  width: 12px;
  color: var(--muted);
  font-size: 11px;
}
.cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 12px;
  font-size: 13px;
  overflow: hidden;
}
.cell.name {
  padding-left: 20px;
  font-size: 14px;
  /* The check mark glows past its cell; the title does its own clipping. */
  overflow: visible;
}
.title {
  min-width: 0;
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row.done .title {
  color: var(--muted);
  text-decoration: line-through;
}
.sub {
  flex: none;
  font-size: 11px;
  color: var(--muted);
}
.cell.edit {
  cursor: pointer;
  align-self: stretch;
}
.cell.edit:hover {
  background: var(--chip);
}
.cell.overdue {
  color: var(--danger);
}
.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty,
.muted {
  color: var(--muted);
}
.chip {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--chip);
  white-space: nowrap;
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
.add {
  padding: 4px 12px 4px 16px;
  position: sticky;
  left: 0;
  width: fit-content;
}
.add input {
  width: 320px;
}
.add .btn-ghost {
  font-size: 13px;
  padding: 4px 8px;
}
.status {
  padding: 12px 20px;
  color: var(--muted);
  font-size: 13px;
}
</style>
