<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { cancelCommentCount, commentCountOf, requestCommentCount } from '../composables/useCommentCounts'
import { cancelSubtaskProgress, requestSubtaskProgress, subtaskProgressOf } from '../composables/useSubtaskProgress'
import { asanaColor, textOn } from '../colors'
import { cardPrefs, projectColor, useSettings } from '../composables/useSettings'
import { useColorMenu } from '../composables/useColorMenu'
import { useTaskOpener } from '../composables/useTaskOpener'
import UiIcon from './UiIcon.vue'
import type { Card, Colored } from '../types'

const props = defineProps<{
  card: Card
  draggable: boolean
  project: string
  selected?: boolean
  focused?: boolean
  quickEdit?: boolean
}>()
const emit = defineEmits<{
  open: [gid: string]
  select: [event: MouseEvent]
  quick: [kind: 'assignee' | 'due' | 'field', event: MouseEvent, field?: string]
  complete: [completed: boolean]
  dragstart: [event: DragEvent]
  dragend: []
}>()

const settings = useSettings()
const colorMenu = useColorMenu()
const opener = useTaskOpener()

function quick(kind: 'assignee' | 'due' | 'field', event: MouseEvent, field?: string): void {
  if (!props.quickEdit) return
  event.stopPropagation()
  emit('quick', kind, event, field)
}

interface Chip {
  field?: string
  key: string
  label: string
  color: string | null
  kind: 'chip' | 'text'
}

const prefs = computed(() => cardPrefs(props.project))
const progress = computed(() => (prefs.value.subtasks && props.card.num_subtasks ? subtaskProgressOf(props.card.gid) : null))
watch(
  () => [props.card.gid, props.card.modified_at, props.card.num_subtasks, prefs.value.subtasks] as const,
  ([gid, modified, count, show]) => {
    if (show && count) requestSubtaskProgress(gid, modified)
  },
  { immediate: true },
)
const showComments = computed(() => prefs.value.comments !== false)
const comments = computed(() => (showComments.value ? commentCountOf(props.card.gid) : 0))
watch(
  () => [props.card.gid, props.card.modified_at, showComments.value] as const,
  ([gid, modified, show]) => {
    if (show) requestCommentCount(gid, modified)
  },
  { immediate: true },
)
// Columns are virtualised: a card scrolled away is unmounted, and its pending lookups are not worth making.
onBeforeUnmount(() => {
  cancelCommentCount(props.card.gid)
  cancelSubtaskProgress(props.card.gid)
})
const otherProjects = computed<Colored[]>(() => (props.card.projects ?? []).filter((p) => p.gid !== props.project))
const showChips = computed(() => settings.indicator === 'chip' || settings.indicator === 'both')
const stripeColor = computed(() => {
  if (settings.indicator !== 'stripe' && settings.indicator !== 'both') return null
  const first = otherProjects.value[0]
  return first ? (projectColor(first) ?? 'var(--muted)') : null
})

const chips = computed<Chip[]>(() => {
  const list: Chip[] = []
  const hidden = new Set(prefs.value.hidden)
  for (const field of props.card.custom_fields ?? []) {
    if (hidden.has(field.gid)) continue
    if (field.resource_subtype === 'enum' && field.enum_value) {
      list.push({ field: field.gid, key: field.gid, label: field.enum_value.name, color: asanaColor(field.enum_value.color), kind: 'chip' })
    } else if (field.resource_subtype === 'multi_enum' && field.multi_enum_values?.length) {
      for (const value of field.multi_enum_values) {
        list.push({ field: field.gid, key: `${field.gid}:${value.gid}`, label: value.name, color: asanaColor(value.color), kind: 'chip' })
      }
    } else if (field.display_value) {
      list.push({ key: field.gid, label: field.display_value, color: null, kind: 'text' })
    }
  }
  if (prefs.value.tags) {
    for (const tag of props.card.tags ?? []) {
      list.push({ key: tag.gid, label: tag.name, color: asanaColor(tag.color), kind: 'chip' })
    }
  }
  return list
})

function colorStyle(color: string | null): Record<string, string> {
  return color ? { background: color, color: textOn(color) } : {}
}

function shortDate(iso: string, withMonth = true): string {
  const date = new Date(`${iso}T00:00:00`)
  return withMonth
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : date.toLocaleDateString(undefined, { day: 'numeric' })
}

const due = computed(() => {
  const { start_on, due_on } = props.card
  if (!due_on || !prefs.value.due) return null
  const date = new Date(`${due_on}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  let label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : shortDate(due_on)
  if (start_on) {
    const sameMonth = start_on.slice(0, 7) === due_on.slice(0, 7)
    label = `${shortDate(start_on)} – ${sameMonth ? shortDate(due_on, false) : shortDate(due_on)}`
  }
  return { label, overdue: days < 0 && !props.card.completed, soon: days >= 0 && days <= 1 && !props.card.completed }
})

const initials = computed(() =>
  props.card.assignee?.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)

const photo = computed(() => props.card.assignee?.photo?.image_27x27 ?? null)
/** Blocked by a task that is still open. Without the blockers' state (older cache) any dependency counts. */
const waiting = computed(
  () => !props.card.completed && (props.card.dependencies ?? []).some((d) => d.completed !== true),
)
</script>

<template>
  <article
    class="card"
    :class="{ completed: card.completed, striped: stripeColor, selected, focused, opened: opener.state.gid === card.gid }"
    :style="stripeColor ? { '--stripe': stripeColor } : undefined"
    :draggable="draggable"
    tabindex="0"
    @click="$event.ctrlKey || $event.metaKey || $event.shiftKey ? emit('select', $event) : emit('open', card.gid)"
    @contextmenu="otherProjects[0] && stripeColor && !showChips ? (colorMenu.open(otherProjects[0], $event), $event.preventDefault()) : undefined"
    @keydown.enter="emit('open', card.gid)"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <div v-if="(showChips && otherProjects.length) || (card.parent && prefs.parent)" class="top">
      <template v-if="showChips">
        <span
          v-for="p in otherProjects"
          :key="p.gid"
          class="project"
          :style="colorStyle(projectColor(p))"
          :title="`Also in ${p.name} · right-click to change color`"
          @contextmenu.prevent.stop="colorMenu.open(p, $event)"
        >
          {{ p.name }}
        </span>
      </template>
      <span v-if="card.parent && prefs.parent" class="parent" :title="card.parent.name">{{ card.parent.name }} ›</span>
    </div>

    <div v-if="quickEdit" class="hover-actions">
      <button title="Assignee" @click="quick('assignee', $event)">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M4 16.5c.8-3 3-4.5 6-4.5s5.2 1.5 6 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
      <button title="Due date" @click="quick('due', $event)">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="head">
      <span v-if="waiting" class="check waiting" title="Waiting on another task"><UiIcon name="hourglass" :size="17" /></span>
      <button
        v-else
        class="check"
        :class="{ done: card.completed }"
        :title="card.completed ? 'Mark incomplete' : 'Mark complete'"
        @click.stop="emit('complete', !card.completed)"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 8.2l2.2 2.2 4.8-4.8" /></svg>
      </button>
      <div class="name">{{ card.name || 'Untitled task' }}</div>
    </div>

    <div v-if="chips.length" class="chips">
      <span
        v-for="chip in chips"
        :key="chip.key"
        class="chip"
        :class="[chip.kind, { editable: quickEdit && chip.field }]"
        :style="colorStyle(chip.color)"
        @click="chip.field ? quick('field', $event, chip.field) : undefined"
      >
        {{ chip.label }}
      </span>
    </div>

    <div v-if="(card.assignee && prefs.assignee) || due || comments || (card.num_subtasks && prefs.subtasks)" class="meta">
      <img
        v-if="photo && prefs.assignee"
        :src="photo"
        class="avatar"
        :alt="card.assignee?.name"
        :title="card.assignee?.name"
        @click="quick('assignee', $event)"
      />
      <span v-else-if="initials && prefs.assignee" class="avatar" :title="card.assignee?.name" @click="quick('assignee', $event)">
        {{ initials }}
      </span>
      <span v-if="due" class="due" :class="{ overdue: due.overdue, soon: due.soon }" @click="quick('due', $event)">
        {{ due.label }}
      </span>
      <span class="counts">
        <span v-if="comments" class="count" title="Comments">
          {{ comments }}
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7.5H8l-3 2.5V11H2.5z" /></svg>
        </span>
      <span
        v-if="card.num_subtasks && prefs.subtasks"
        class="subtasks"
        :class="{ complete: progress && progress.total > 0 && progress.done === progress.total }"
        :title="progress ? `${progress.done} of ${progress.total} subtasks done` : 'Subtasks'">
        {{ progress && progress.total ? `${progress.done}/${progress.total}` : card.num_subtasks }}
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v8a2 2 0 0 0 2 2h6M9 9l3 3-3 3" /></svg>
      </span>
      </span>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--card);
  border-radius: var(--radius);
  padding: var(--pad) calc(var(--pad) + 2px);
  font-size: var(--card-font);
  cursor: pointer;
  user-select: none;
  box-shadow: var(--shadow-raised);
  border: 1px solid transparent;
  transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
}
.card.striped {
  border-left: 3px solid var(--stripe);
  box-shadow: var(--shadow-raised), -2px 0 10px -2px color-mix(in srgb, var(--stripe) 65%, transparent);
}
:root[data-glow='off'] .card.striped {
  box-shadow: var(--shadow-raised);
}
.card:hover {
  transform: translateY(-1px);
  border-color: var(--border);
  border-left-color: var(--stripe, var(--border));
}
.card:focus-visible {
  outline: none;
  box-shadow: var(--shadow-raised), var(--glow);
}
.card.opened,
.card.opened:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--card));
  box-shadow: var(--shadow-raised), var(--glow);
}
.card.focused,
.card.focused:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-raised), 0 0 0 1px var(--accent), var(--glow);
}
.hover-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--card);
  box-shadow: var(--shadow-raised);
  opacity: 0;
  pointer-events: none;
  z-index: 1;
}
.card:hover .hover-actions {
  opacity: 1;
  pointer-events: auto;
}
.hover-actions button {
  width: 24px;
  height: 24px;
  padding: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--muted);
  border-radius: 6px;
}
.hover-actions button:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
.hover-actions svg {
  width: 15px;
  height: 15px;
}
.chip.editable,
.card .avatar,
.card .due {
  cursor: pointer;
}
.chip.editable:hover {
  filter: brightness(1.12);
}
.card.selected,
.card.selected:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--card));
  box-shadow: var(--shadow-raised), var(--glow);
}
.card.striped:hover {
  box-shadow: var(--shadow-raised), -3px 0 14px -2px color-mix(in srgb, var(--stripe) 80%, transparent);
}
.card.completed .name {
  color: var(--muted);
  text-decoration: line-through;
  text-decoration-color: var(--border-strong);
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.project {
  font-size: 11px;
  font-weight: 800;
  line-height: 16px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--chip);
  color: var(--text);
  letter-spacing: 0.01em;
}
.parent {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.check {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 1px;
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
.check.waiting {
  border: none;
  color: var(--warn);
}
.name {
  line-height: calc(1.4 * var(--text-scale));
  word-break: break-word;
  font-weight: 600;
  color: var(--text-strong);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.chip {
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--chip);
  color: var(--text);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip.text {
  background: var(--surface-2);
  color: var(--muted);
  font-weight: 600;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10.5px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 800;
  object-fit: cover;
}
.subtasks.complete {
  color: var(--text);
  font-weight: 800;
}
.counts {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.subtasks,
.count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.count svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.subtasks svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.due.soon {
  color: var(--ok);
}
.due.overdue {
  color: var(--danger);
}
</style>
