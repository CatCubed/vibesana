<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, onMounted, ref } from 'vue'
import { asanaColor, textOn } from '../colors'
import { addDays, toISO, today } from '../dates'
import { useClickOutside } from '../composables/useClickOutside'
import TypeaheadPicker from './task/TypeaheadPicker.vue'
import type { Card, FieldDef, TypeaheadResult } from '../types'

const props = defineProps<{
  card: Card
  kind: 'assignee' | 'due' | 'field'
  field: FieldDef | null
  x: number
  y: number
}>()
const emit = defineEmits<{ close: []; save: [fields: Record<string, unknown>] }>()

const root = ref<HTMLElement | null>(null)
const position = ref({ left: props.x, top: props.y })

useClickOutside(root, () => emit('close'))

onMounted(() => {
  const width = props.kind === 'assignee' ? 330 : 230
  position.value = {
    left: Math.max(8, Math.min(props.x, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(props.y, window.innerHeight - 340)),
  }
})

const quick = computed(() => {
  const now = today()
  const monday = addDays(now, (8 - now.getDay()) % 7 || 7)
  return [
    { label: 'Today', iso: toISO(now) },
    { label: 'Tomorrow', iso: toISO(addDays(now, 1)) },
    { label: 'Next Monday', iso: toISO(monday) },
    { label: 'In a week', iso: toISO(addDays(now, 7)) },
  ]
})

const current = computed(() => props.card.custom_fields?.find((f) => f.gid === props.field?.gid) ?? null)
const options = computed(() => (props.field?.enum_options ?? []).filter((o) => o.enabled))
const multi = computed(() => props.field?.resource_subtype === 'multi_enum')
const chosen = computed(
  () => new Set(multi.value ? (current.value?.multi_enum_values ?? []).map((v) => v.gid) : [current.value?.enum_value?.gid]),
)

function chipStyle(color: string | null): Record<string, string> {
  const hex = asanaColor(color)
  return hex ? { background: hex, color: textOn(hex) } : {}
}

function pickUser(user: TypeaheadResult): void {
  emit('save', { assignee: user.gid })
}

function pickOption(gid: string | null): void {
  if (!props.field) return
  if (!multi.value) {
    emit('save', { custom_fields: { [props.field.gid]: gid } })
    return
  }
  const next = new Set([...chosen.value].filter(Boolean) as string[])
  if (gid === null) next.clear()
  else if (next.has(gid)) next.delete(gid)
  else next.add(gid)
  emit('save', { custom_fields: { [props.field.gid]: [...next] } })
}
</script>

<template>
  <div ref="root" class="quick" :style="{ left: `${position.left}px`, top: `${position.top}px` }" @keydown.esc.stop="emit('close')">
    <template v-if="kind === 'assignee'">
      <TypeaheadPicker type="user" placeholder="Assign to…" class="inline" @pick="pickUser" @close="emit('close')" />
      <button v-if="card.assignee" class="unassign panel" @click="emit('save', { assignee: null })">Unassign</button>
    </template>

    <div v-else-if="kind === 'due'" class="menu panel">
      <h5 class="eyebrow">Due date</h5>
      <button v-for="q in quick" :key="q.label" :class="{ on: q.iso === card.due_on }" @click="emit('save', { due_on: q.iso })">
        {{ q.label }}
      </button>
      <input
        type="date"
        :value="card.due_on ?? ''"
        @change="emit('save', { due_on: ($event.target as HTMLInputElement).value || null })"
      />
      <button v-if="card.due_on" class="muted" @click="emit('save', { due_on: null })">No due date</button>
    </div>

    <div v-else-if="field" class="menu panel">
      <h5 class="eyebrow">{{ field.name }}</h5>
      <button v-for="o in options" :key="o.gid" :class="{ on: chosen.has(o.gid) }" @click="pickOption(o.gid)">
        <span class="chip" :style="chipStyle(o.color)">{{ o.name }}</span>
        <span v-if="chosen.has(o.gid)" class="tick"><UiIcon name="check" :size="13" /></span>
      </button>
      <button v-if="current?.enum_value || current?.multi_enum_values?.length" class="muted" @click="pickOption(null)">Clear</button>
    </div>
  </div>
</template>

<style scoped>
.quick {
  position: fixed;
  z-index: 55;
}
.quick :deep(.popover.inline) {
  position: static;
}
.unassign {
  margin-top: 4px;
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--danger);
  border: 1px solid var(--border);
}
.menu {
  width: 220px;
  max-height: 330px;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
.menu h5 {
  margin: 4px 8px 6px;
}
.menu button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  background: transparent;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.menu button:hover {
  background: var(--chip);
}
.menu button.on {
  background: var(--accent-soft);
}
.menu input {
  margin: 4px 0;
}
.menu .muted {
  color: var(--muted);
}
.chip {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 5px;
  background: var(--chip);
}
.tick {
  color: var(--accent);
  font-weight: 800;
}
</style>
