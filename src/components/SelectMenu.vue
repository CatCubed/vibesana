<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import UiIcon from './UiIcon.vue'
import { pushLayer } from '../layers'

export interface SelectOption {
  value: string
  label: string
  group?: string
}

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  /** Shown when the value matches no option. */
  placeholder?: string
  label?: string
  compact?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; open: [] }>()
defineOptions({ inheritAttrs: false })

const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const open = ref(false)
const active = ref(0)
const place = ref({ left: 0, top: 0, minWidth: 0, maxHeight: 320, up: false })
const id = `select-${Math.random().toString(36).slice(2, 8)}`
let removeLayer: (() => void) | null = null

const current = computed(() => props.options.find((o) => o.value === props.modelValue))

function position(): void {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const up = below < 200 && above > below
  place.value = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8)),
    top: up ? rect.top - 4 : rect.bottom + 4,
    minWidth: rect.width,
    maxHeight: Math.max(120, Math.min(360, up ? above : below)),
    up,
  }
}

function onOutside(event: Event): void {
  const target = event.target as Node
  if (trigger.value?.contains(target) || list.value?.contains(target)) return
  close()
}

function show(): void {
  if (open.value) return
  emit('open')
  position()
  active.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue))
  open.value = true
  removeLayer = pushLayer(close)
  document.addEventListener('mousedown', onOutside, true)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onOutside, true)
  void nextTick(scrollToActive)
}

function close(): void {
  if (!open.value) return
  open.value = false
  removeLayer?.()
  removeLayer = null
  document.removeEventListener('mousedown', onOutside, true)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onOutside, true)
}

onBeforeUnmount(close)
// Options that arrive after opening (loaded on demand) keep the highlight on the current value.
watch(
  () => props.options,
  (options) => {
    if (open.value) active.value = Math.max(0, options.findIndex((o) => o.value === props.modelValue))
  },
)

function scrollToActive(): void {
  list.value?.querySelector('.option.active')?.scrollIntoView({ block: 'nearest' })
}

function pick(option: SelectOption): void {
  close()
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}

function onKey(event: KeyboardEvent): void {
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show()
    }
    return
  }
  const last = props.options.length - 1
  if (event.key === 'ArrowDown') active.value = Math.min(active.value + 1, last)
  else if (event.key === 'ArrowUp') active.value = Math.max(active.value - 1, 0)
  else if (event.key === 'Home') active.value = 0
  else if (event.key === 'End') active.value = last
  else if (event.key === 'Enter' || event.key === ' ') {
    const option = props.options[active.value]
    if (option) pick(option)
  } else if (event.key === 'Tab') {
    close()
    return
  } else return
  event.preventDefault()
  event.stopPropagation()
  void nextTick(scrollToActive)
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="select"
    :class="{ open, compact }"
    role="combobox"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-controls="id"
    :aria-label="label"
    :aria-activedescendant="open ? `${id}-${active}` : undefined"
    v-bind="$attrs"
    @click="open ? close() : show()"
    @keydown="onKey"
  >
    <span class="value" :class="{ placeholder: !current }">{{ current?.label ?? placeholder ?? '' }}</span>
    <UiIcon name="chevron-down" :size="14" />
  </button>
  <Teleport to="body">
    <ul
      v-if="open"
      :id="id"
      ref="list"
      class="select-list popup"
      :class="{ up: place.up }"
      role="listbox"
      data-layer
      :style="{ left: `${place.left}px`, top: `${place.top}px`, minWidth: `${place.minWidth}px`, maxHeight: `${place.maxHeight}px` }"
    >
      <template v-for="(option, index) in options" :key="option.value">
        <li v-if="option.group && option.group !== options[index - 1]?.group" class="group" role="presentation">{{ option.group }}</li>
        <li
          :id="`${id}-${index}`"
          class="option"
          :class="{ active: index === active, selected: option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          @mouseenter="active = index"
          @mousedown.prevent
          @click="pick(option)"
        >
          <span class="option-label">{{ option.label }}</span>
          <UiIcon v-if="option.value === modelValue" name="check" :size="14" />
        </li>
      </template>
      <li v-if="!options.length" class="group" role="presentation">Nothing to choose from</li>
    </ul>
  </Teleport>
</template>

<style scoped>
.select {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  max-width: 100%;
  padding: 6px 10px;
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
  color: var(--text);
  font-weight: 600;
  text-align: left;
}
.select.compact {
  padding: 2px 8px;
  font-size: 12px;
  max-width: 220px;
}
.select.open {
  border-color: var(--accent-ring);
}
.value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.value.placeholder {
  color: var(--muted);
}
.select :deep(svg) {
  color: var(--muted);
}
</style>

<style>
.select-list {
  position: fixed;
  z-index: 300;
  margin: 0;
  padding: 5px;
  list-style: none;
  overflow-y: auto;
  font-size: 13px;
}
.select-list.up {
  transform: translateY(-100%);
}
.select-list .group {
  padding: 8px 9px 3px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.select-list .option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 9px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}
.select-list .option.active {
  background: var(--chip);
}
.select-list .option.selected {
  color: var(--accent);
  font-weight: 700;
}
</style>
