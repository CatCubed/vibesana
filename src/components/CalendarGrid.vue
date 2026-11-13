<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, ref } from 'vue'
import { addDays, rangeDays, toISO, today } from '../dates'
import type { Card } from '../types'

const props = defineProps<{ cards: Card[] }>()
const emit = defineEmits<{ open: [gid: string]; reschedule: [gid: string, iso: string] }>()

const MAX = 4
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const cursor = ref(new Date(today().getFullYear(), today().getMonth(), 1))
const expanded = ref<string | null>(null)
const dragging = ref<string | null>(null)
const over = ref<string | null>(null)

type Part = 'single' | 'start' | 'middle' | 'end'
interface Entry {
  card: Card
  /** Where this day falls in the task's start–due range. */
  part: Part
}

const byDay = computed(() => {
  const map = new Map<string, Entry[]>()
  for (const card of props.cards) {
    if (!card.due_on) continue
    const days = rangeDays(card.start_on, card.due_on)
    days.forEach((iso, index) => {
      const part: Part = days.length === 1 ? 'single' : index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'
      const list = map.get(iso)
      if (list) list.push({ card, part })
      else map.set(iso, [{ card, part }])
    })
  }
  // Ranges first, so a multi-day task keeps the same row across the days it spans as often as possible.
  for (const list of map.values()) list.sort((a, b) => Number(a.part === 'single') - Number(b.part === 'single'))
  return map
})

function onDragStart(event: DragEvent, gid: string): void {
  // Firefox only starts a drag that carries data.
  event.dataTransfer?.setData('text/plain', gid)
  dragging.value = gid
}
const undated = computed(() => props.cards.filter((c) => !c.due_on).length)
const label = computed(() => cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))

const cells = computed(() => {
  const first = cursor.value
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const todayIso = toISO(today())
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    const iso = toISO(date)
    return {
      iso,
      day: date.getDate(),
      outside: date.getMonth() !== first.getMonth(),
      today: iso === todayIso,
      weekend: date.getDay() === 0 || date.getDay() === 6,
      cards: byDay.value.get(iso) ?? [],
    }
  })
})

function shift(months: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + months, 1)
  expanded.value = null
}

function goToday(): void {
  cursor.value = new Date(today().getFullYear(), today().getMonth(), 1)
}

function onDrop(iso: string): void {
  const gid = dragging.value
  dragging.value = null
  over.value = null
  if (gid) emit('reschedule', gid, iso)
}
</script>

<template>
  <div class="calendar">
    <header>
      <button class="btn-ghost nav" title="Previous month" aria-label="Previous month" @click="shift(-1)"><UiIcon name="chevron-left" :size="16" /></button>
      <strong>{{ label }}</strong>
      <button class="btn-ghost nav" title="Next month" aria-label="Next month" @click="shift(1)"><UiIcon name="chevron-right" :size="16" /></button>
      <button class="btn-ghost today-btn" @click="goToday">Today</button>
      <span class="spacer" />
      <span v-if="undated" class="muted">{{ undated }} tasks without a due date are not shown</span>
      <span class="muted">Dropping a task on a day sets its due date</span>
    </header>
    <div class="weekdays">
      <span v-for="w in weekdays" :key="w">{{ w }}</span>
    </div>
    <div class="grid">
      <div
        v-for="cell in cells"
        :key="cell.iso"
        class="cell"
        :class="{ outside: cell.outside, today: cell.today, weekend: cell.weekend, over: over === cell.iso }"
        @dragover.prevent="over = cell.iso"
        @drop.prevent="onDrop(cell.iso)"
      >
        <span class="day">{{ cell.day }}</span>
        <button
          v-for="{ card, part } in expanded === cell.iso ? cell.cards : cell.cards.slice(0, MAX)"
          :key="card.gid"
          class="task"
          :class="[part, { done: card.completed }]"
          :title="part === 'single' ? card.name : `${card.name} (${card.start_on} – ${card.due_on})`"
          draggable="true"
          @click="emit('open', card.gid)"
          @dragstart="onDragStart($event, card.gid)"
          @dragend="dragging = null; over = null"
        >
          {{ card.name || 'Untitled task' }}
        </button>
        <button v-if="cell.cards.length > MAX && expanded !== cell.iso" class="more" @click="expanded = cell.iso">
          +{{ cell.cards.length - MAX }} more
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 20px 20px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
}
header strong {
  min-width: 150px;
  text-align: center;
  font-size: 15px;
  color: var(--text-strong);
}
.nav {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  font-size: 22px;
  line-height: 1;
}
.today-btn {
  font-size: 13px;
  padding: 4px 12px;
}
.spacer {
  flex: 1;
}
.muted {
  font-size: 12px;
  color: var(--muted);
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 0 6px 6px;
}
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(104px, 1fr);
  gap: 6px;
  overflow-y: auto;
}
.cell {
  background: var(--surface);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  padding: 4px 6px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
}
.cell.weekend {
  background: color-mix(in srgb, var(--surface) 70%, var(--bg));
}
.cell.outside {
  opacity: 0.5;
}
.cell.over {
  border-color: var(--accent);
  box-shadow: var(--glow);
}
.day {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  align-self: flex-end;
  min-width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}
.cell.today .day {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
.task {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--text-strong);
  border-left: 3px solid var(--accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: none;
}
/* A task with a start date runs across its days as one bar: square where it continues, the stripe only at its start. */
.task.middle,
.task.end {
  border-left-color: transparent;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin-left: -6px;
  color: color-mix(in srgb, var(--text-strong) 55%, transparent);
}
.task.start,
.task.middle {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  margin-right: -6px;
}
.task:hover {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
}
.task.done {
  color: var(--muted);
  text-decoration: line-through;
  border-left-color: var(--border-strong);
  background: var(--surface-2);
}
.more {
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  padding: 0 4px;
  text-align: left;
}
</style>
