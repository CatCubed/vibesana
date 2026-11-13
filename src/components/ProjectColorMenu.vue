<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { PALETTE, asanaColor, textOn } from '../colors'
import { useClickOutside } from '../composables/useClickOutside'
import { projectColor, setProjectColor, useSettings } from '../composables/useSettings'
import type { Colored } from '../types'

const props = defineProps<{ project: Colored; x: number; y: number }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettings()
const root = ref<HTMLElement | null>(null)
const position = ref({ left: props.x, top: props.y })

useClickOutside(root, () => emit('close'))

onMounted(() => {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  position.value = {
    left: Math.min(props.x, window.innerWidth - rect.width - 8),
    top: Math.min(props.y, window.innerHeight - rect.height - 8),
  }
  window.addEventListener('keydown', onKey, { once: true })
})

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

const SWATCHES = [
  'red', 'orange', 'yellow-orange', 'yellow', 'yellow-green', 'green', 'blue-green', 'aqua',
  'blue', 'indigo', 'purple', 'magenta', 'hot-pink', 'pink', 'cool-gray', 'light-teal',
].map((name) => PALETTE[name])

const current = computed(() => projectColor(props.project) ?? '#6d6e6f')
const isCustom = computed(() => props.project.gid in settings.projectColors)
const asanaDefault = computed(() => asanaColor(props.project.color))

function pick(hex: string): void {
  setProjectColor(props.project.gid, hex)
}

function reset(): void {
  setProjectColor(props.project.gid, null)
}
</script>

<template>
  <div ref="root" class="menu panel" :style="{ left: `${position.left}px`, top: `${position.top}px` }">
    <div class="head">
      <span class="preview" :style="{ background: current, color: textOn(current) }">{{ project.name }}</span>
    </div>
    <div class="swatches">
      <button
        v-for="hex in SWATCHES"
        :key="hex"
        class="swatch"
        :class="{ on: hex.toLowerCase() === current.toLowerCase() }"
        :style="{ background: hex }"
        @click="pick(hex)"
      />
      <label class="swatch custom" title="Custom color">
        <input type="color" :value="current" @input="pick(($event.target as HTMLInputElement).value)" />
        <span>+</span>
      </label>
    </div>
    <div class="foot">
      <span class="muted">Only on this device</span>
      <button class="btn-ghost tiny" :disabled="!isCustom" @click="reset">
        Asana color
        <i v-if="asanaDefault" class="dot" :style="{ background: asanaDefault }" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu {
  position: fixed;
  z-index: 60;
  width: 236px;
  padding: 10px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
}
.head {
  display: flex;
  margin-bottom: 10px;
}
.preview {
  font-size: 12px;
  font-weight: 800;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.swatches {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.swatch {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: 2px solid transparent;
}
.swatch:hover {
  transform: scale(1.08);
}
.swatch.on {
  border-color: var(--text-strong);
  box-shadow: 0 0 10px currentColor;
}
.custom {
  position: relative;
  display: grid;
  place-items: center;
  background: var(--surface-2);
  box-shadow: var(--shadow-inset);
  color: var(--muted);
  font-weight: 800;
  cursor: pointer;
}
.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  padding: 0;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.muted {
  font-size: 11px;
  color: var(--muted);
}
.tiny {
  font-size: 12px;
  padding: 3px 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
