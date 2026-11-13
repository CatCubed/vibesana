<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, ref } from 'vue'
import { addDays, formatDay, parseISO, toISO, today } from '../dates'
import { useDismiss } from '../layers'
import { sideFor, type Side } from '../popup'

const props = withDefaults(
  defineProps<{
    value: string | null
    placeholder?: string
    rangeFrom?: string | null
    rangeTo?: string | null
    align?: 'left' | 'right'
    compact?: boolean
  }>(),
  { placeholder: 'Set date', rangeFrom: null, rangeTo: null, align: 'right', compact: false },
)
const emit = defineEmits<{ change: [value: string | null] }>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const cursor = ref(startOfMonth(props.value ? parseISO(props.value) : today()))

useDismiss(root, open)
const side = ref<Side>(props.align)

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function toggle(): void {
  open.value = !open.value
  // The calendar is about 410px wide; hang it from whichever edge keeps it inside the panel.
  if (open.value && root.value) side.value = sideFor(root.value, 420, props.align)
  if (open.value) cursor.value = startOfMonth(props.value ? parseISO(props.value) : today())
}

defineExpose({
  open: () => {
    if (!open.value) toggle()
  },
})

function pick(iso: string | null): void {
  emit('change', iso)
  open.value = false
}

const quick = computed(() => {
  const now = today()
  const monday = addDays(now, ((8 - now.getDay()) % 7) || 7)
  return [
    { label: 'Today', iso: toISO(now) },
    { label: 'Tomorrow', iso: toISO(addDays(now, 1)) },
    { label: 'Next Monday', iso: toISO(monday) },
    { label: 'In a week', iso: toISO(addDays(now, 7)) },
  ]
})

const monthLabel = computed(() => cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const grid = computed(() => {
  const first = cursor.value
  const offset = (first.getDay() + 6) % 7
  const start = addDays(first, -offset)
  const todayIso = toISO(today())
  const from = props.rangeFrom ?? props.value
  const to = props.rangeTo ?? props.value
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    const iso = toISO(date)
    return {
      iso,
      day: date.getDate(),
      outside: date.getMonth() !== first.getMonth(),
      today: iso === todayIso,
      selected: iso === props.value,
      inRange: Boolean(from && to && from !== to && iso >= from && iso <= to),
      rangeEdge: iso === from || iso === to,
    }
  })
})

const label = computed(() => (props.value ? formatDay(props.value) : props.placeholder))
const overdue = computed(() => props.value !== null && props.value < toISO(today()))
</script>

<template>
  <div ref="root" class="picker" :class="{ open }">
    <button class="trigger" :class="{ empty: !value, overdue, compact }" :aria-label="label ? undefined : placeholder || 'Set date'" aria-haspopup="dialog" :aria-expanded="open" @click="toggle">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="4.5" width="14" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <span v-if="label">{{ label }}</span>
      <span v-if="value" class="clear" title="Clear" @click.stop="pick(null)"><UiIcon name="close" :size="14" /></span>
    </button>

    <div v-if="open" class="pop popup" :class="side">
      <div class="quick">
        <h5 class="eyebrow">Quick</h5>
        <button v-for="q in quick" :key="q.label" :class="{ on: q.iso === value }" @click="pick(q.iso)">
          {{ q.label }}
        </button>
        <button class="muted-btn" :disabled="!value" @click="pick(null)">No date</button>
      </div>
      <div class="cal">
        <div class="cal-head">
          <strong>{{ monthLabel }}</strong>
          <span class="nav">
            <button class="btn-ghost" @click="cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)"><UiIcon name="chevron-left" :size="16" /></button>
            <button class="btn-ghost" @click="cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)"><UiIcon name="chevron-right" :size="16" /></button>
          </span>
        </div>
        <div class="grid">
          <span v-for="(w, i) in weekdays" :key="i" class="wd">{{ w }}</span>
          <button
            v-for="cell in grid"
            :key="cell.iso"
            class="day"
            :class="{
              outside: cell.outside,
              today: cell.today,
              selected: cell.selected,
              range: cell.inRange,
              edge: cell.rangeEdge && !cell.selected,
            }"
            @click="pick(cell.iso)"
          >
            {{ cell.day }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
  display: inline-block;
}
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 8px;
  border-radius: var(--radius-pill);
  background: transparent;
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}
.trigger.compact {
  padding: 2px 8px 2px 6px;
  font-size: 12px;
}
.trigger svg {
  width: 16px;
  height: 16px;
  color: var(--muted);
}
.trigger.empty {
  color: var(--muted);
  font-weight: 600;
}
.trigger.overdue {
  color: var(--danger);
}
.trigger:hover {
  background: var(--chip);
}
.open .trigger {
  background: var(--accent-soft);
  color: var(--accent);
}
.clear {
  font-size: 10px;
  color: var(--muted);
  margin-left: 2px;
}
.clear:hover {
  color: var(--danger);
}
.pop {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  display: flex;
  overflow: hidden;
}
.pop.right {
  right: 0;
}
.pop.left {
  left: 0;
}
.quick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px;
  background: var(--surface-2);
  min-width: 140px;
}
.quick h5 {
  margin: 0 6px 6px;
}
.quick button {
  text-align: left;
  background: transparent;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.quick button:hover {
  background: var(--chip);
}
.quick button.on {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
.muted-btn {
  color: var(--muted);
  margin-top: auto;
}
.cal {
  padding: 12px 12px 10px;
  width: 268px;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-left: 4px;
}
.nav {
  display: flex;
  gap: 2px;
}
.nav button {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  font-size: 15px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px 0;
}
.wd {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  padding: 4px 0 6px;
}
.day {
  height: 32px;
  padding: 0;
  background: transparent;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}
.day.outside {
  color: color-mix(in srgb, var(--muted) 70%, transparent);
  font-weight: 500;
}
.day:hover {
  background: var(--chip);
}
.day.today {
  box-shadow: inset 0 0 0 1.5px var(--accent);
  color: var(--accent);
}
.day.range {
  background: var(--accent-soft);
  border-radius: 0;
}
.day.edge {
  background: var(--accent-soft);
  color: var(--accent);
}
.day.selected {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--glow);
}
</style>
