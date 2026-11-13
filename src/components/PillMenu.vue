<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { ref } from 'vue'
import { useDismiss } from '../layers'

defineProps<{ on?: boolean; title?: string; wide?: boolean }>()
const emit = defineEmits<{ clear: [] }>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
useDismiss(root, open)

defineExpose({ close: () => (open.value = false) })
</script>

<template>
  <div ref="root" class="wrap">
    <button class="pill" :class="{ on, open }" :title="title" @click="open = !open">
      <slot name="label" />
      <span v-if="on" class="x" title="Clear" @click.stop="emit('clear'); open = false"><UiIcon name="close" :size="14" /></span>
    </button>
    <div v-if="open" class="menu popup" :class="{ wide }" @click="$event.stopPropagation()">
      <slot :close="() => (open = false)" />
    </div>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
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
.pill :deep(svg) {
  width: 16px;
  height: 16px;
}
.pill:hover {
  background: var(--surface);
  color: var(--text-strong);
}
.pill.on,
.pill.open {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-ring);
}
.x {
  font-size: 11px;
  opacity: 0.8;
}
.x:hover {
  opacity: 1;
}
.menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Long lists (a field with many options) scroll inside the menu instead of running off the page. */
  max-height: min(560px, calc(100dvh - 190px));
  overflow-y: auto;
  overscroll-behavior: contain;
}
.menu.wide {
  min-width: 280px;
}
.menu :deep(button.opt),
.menu :deep(label.opt) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: transparent;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.menu :deep(.opt:hover) {
  background: var(--chip);
}
.menu :deep(.opt.on) {
  background: var(--accent-soft);
  color: var(--accent);
}
.menu :deep(h5) {
  margin: 8px 10px 4px;
}
.menu :deep(.sep) {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
</style>
