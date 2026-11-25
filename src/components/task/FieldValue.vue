<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
import { computed, ref, watch } from 'vue'
import { asanaColor, textOn } from '../../colors'
import { useDismiss } from '../../layers'
import DatePicker from '../DatePicker.vue'
import { inOptionOrder, sameMembers, toggled } from '../../multiselect'
import type { Colored, CustomField } from '../../types'

const props = defineProps<{ field: CustomField }>()
const emit = defineEmits<{ save: [value: unknown] }>()

const menu = ref<HTMLElement | null>(null)
const open = ref(false)
const draft = ref('')

/** Multi-option fields: what is ticked while the menu is open. Saved once, when the menu closes. */
const picked = ref(new Set<string>())

function openMenu(): void {
  picked.value = new Set(selected.value.map((s) => s.gid))
  open.value = true
}

function closeMenu(): void {
  if (!open.value) return
  open.value = false
  if (props.field.resource_subtype !== 'multi_enum') return
  const before = new Set(selected.value.map((s) => s.gid))
  if (!sameMembers(before, picked.value)) emit('save', inOptionOrder(options.value, picked.value, selected.value))
}

function toggleMenu(): void {
  if (open.value) closeMenu()
  else openMenu()
}

useDismiss(menu, open, closeMenu)

watch(
  () => props.field,
  (field) => {
    if (field.resource_subtype === 'text') draft.value = field.text_value ?? ''
    else if (field.resource_subtype === 'number') draft.value = field.number_value?.toString() ?? ''
  },
  { immediate: true },
)

const options = computed(() => (props.field.enum_options ?? []).filter((o) => o.enabled))
const selected = computed(() => props.field.multi_enum_values ?? [])
/** The chips on the field: while the menu is open they follow the ticks, so the change is visible at once. */
const shown = computed(() => {
  if (!open.value || props.field.resource_subtype !== 'multi_enum') return selected.value
  const known = new Map([...selected.value, ...options.value].map((o) => [o.gid, o]))
  return inOptionOrder(options.value, picked.value, selected.value).map((gid) => known.get(gid)!)
})

function chipStyle(option: Colored): Record<string, string> {
  const color = asanaColor(option.color)
  return color ? { background: color, color: textOn(color) } : {}
}

/** Single-option fields: one click picks and closes. */
function pick(option: Colored | null): void {
  open.value = false
  emit('save', option?.gid ?? null)
}

/** Multi-option fields: a click ticks or unticks and the menu stays open for the next one. */
function toggle(option: Colored): void {
  picked.value = toggled(picked.value, option.gid)
}

function removeValue(option: Colored): void {
  if (open.value) {
    picked.value = toggled(picked.value, option.gid)
    return
  }
  emit(
    'save',
    selected.value.filter((s) => s.gid !== option.gid).map((s) => s.gid),
  )
}

function saveText(): void {
  if (props.field.resource_subtype === 'text' && draft.value !== (props.field.text_value ?? '')) {
    emit('save', draft.value)
  }
  if (props.field.resource_subtype === 'number' && draft.value !== (props.field.number_value?.toString() ?? '')) {
    emit('save', draft.value === '' ? null : Number(draft.value))
  }
}
</script>

<template>
  <div class="value">
    <template v-if="field.resource_subtype === 'enum' || field.resource_subtype === 'multi_enum'">
      <div
        ref="menu"
        class="enum"
        role="button"
        tabindex="0"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-label="field.name"
        @click="toggleMenu"
        @keydown.enter.self.prevent="toggleMenu"
        @keydown.space.self.prevent="toggleMenu"
      >
        <template v-if="field.resource_subtype === 'enum'">
          <span v-if="field.enum_value" class="chip" :style="chipStyle(field.enum_value)">{{ field.enum_value.name }}</span>
          <span v-else class="empty">—</span>
        </template>
        <template v-else>
          <span v-for="option in shown" :key="option.gid" class="chip" :style="chipStyle(option)">
            {{ option.name }}
            <button class="remove" title="Remove" aria-label="Remove" @click.stop="removeValue(option)"><UiIcon name="close" :size="14" /></button>
          </span>
          <span v-if="!shown.length" class="empty">—</span>
        </template>
        <div v-if="open" class="menu popup" @click.stop>
          <button v-if="field.resource_subtype === 'enum' && field.enum_value" class="option" @click="pick(null)">
            <span class="empty">Clear</span>
          </button>
          <template v-if="field.resource_subtype === 'enum'">
            <button v-for="option in options" :key="option.gid" class="option" @click="pick(option)">
              <span class="chip" :style="chipStyle(option)">{{ option.name }}</span>
            </button>
          </template>
          <template v-else>
            <button
              v-for="option in options"
              :key="option.gid"
              class="option check"
              role="menuitemcheckbox"
              :aria-checked="picked.has(option.gid)"
              :class="{ on: picked.has(option.gid) }"
              @click="toggle(option)"
            >
              <span class="box"><UiIcon v-if="picked.has(option.gid)" name="check" :size="12" /></span>
              <span class="chip" :style="chipStyle(option)">{{ option.name }}</span>
            </button>
            <p v-if="options.length" class="hint">Tick as many as you need; click outside or press Esc to save.</p>
          </template>
          <p v-if="!options.length" class="empty pad">No options</p>
        </div>
      </div>
    </template>

    <input
      v-else-if="field.resource_subtype === 'text' || field.resource_subtype === 'number'"
      v-model="draft"
      class="inline"
      :type="field.resource_subtype === 'number' ? 'number' : 'text'"
      placeholder="—"
      @blur="saveText"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />

    <DatePicker
      v-else-if="field.resource_subtype === 'date'"
      :value="field.date_value?.date ?? null"
      placeholder="—"
      compact
      @change="emit('save', $event ? { date: $event } : null)"
    />

    <span v-else :class="{ empty: !field.display_value }">{{ field.display_value || '—' }}</span>
  </div>
</template>

<style scoped>
.value {
  min-height: 28px;
  display: flex;
  align-items: center;
}
.enum {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  min-height: 28px;
  align-items: center;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.enum:hover {
  background: var(--chip);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--chip);
  min-width: 56px;
}
.remove {
  border: none;
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: 10px;
  opacity: 0;
}
.chip:hover .remove {
  opacity: 0.8;
}
.menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  cursor: default;
}
.option {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 5px 6px;
}
.option:hover {
  background: var(--chip);
}
.option.check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.box {
  flex: none;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
  color: var(--accent-contrast);
}
.option.on .box {
  background: var(--accent);
  border-color: var(--accent);
}
.hint {
  margin: 4px 6px 2px;
  font-size: 11px;
  color: var(--muted);
  line-height: calc(1.3 * var(--text-scale));
}
.inline {
  width: 100%;
  border-color: transparent;
  background: transparent;
}
.inline:hover {
  border-color: var(--border);
}
.empty {
  color: var(--muted);
}
.pad {
  padding: 6px;
  margin: 0;
}
</style>
