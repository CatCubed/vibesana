<script setup lang="ts">
import { useColorMenu } from '../composables/useColorMenu'
import ProjectIcon from './ProjectIcon.vue'
import UiIcon from './UiIcon.vue'
import type { Project } from '../types'

const props = defineProps<{ item: Project; active: boolean; draggable?: boolean; drop?: boolean; ghosted?: boolean; canSplit?: boolean }>()
const emit = defineEmits<{ pick: [newTab: boolean]; split: []; dragstart: []; dragend: []; dragover: []; drop: [] }>()

const colorMenu = useColorMenu()

function onDragOver(event: DragEvent): void {
  if (!props.draggable) return
  event.preventDefault()
  emit('dragover')
}

function onDrop(event: DragEvent): void {
  if (!props.draggable) return
  event.preventDefault()
  emit('drop')
}
</script>

<template>
  <div
    class="item"
    :class="{ active, drop, ghosted }"
    role="button"
    tabindex="0"
    :draggable="draggable ? 'true' : undefined"
    title="Ctrl+click or middle-click opens it beside the current board"
    @click="emit('pick', $event.ctrlKey || $event.metaKey)"
    @auxclick.middle.prevent="emit('pick', true)"
    @keydown.enter="emit('pick', $event.ctrlKey || $event.metaKey)"
    @contextmenu.prevent="colorMenu.open(item, $event)"
    @dragstart="emit('dragstart')"
    @dragend="emit('dragend')"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <ProjectIcon :project="item" :size="22" />
    <span class="name">{{ item.name }}</span>
    <button v-if="canSplit" class="paint" title="Show beside the current board (split view)" @click.stop="emit('split')">
      <UiIcon name="split" :size="15" />
    </button>
    <button class="paint" title="Change color" @click.stop="colorMenu.open(item, $event)">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M10 3a7 7 0 1 0 0 14c1.1 0 1.6-.7 1.6-1.4 0-.5-.2-.8-.5-1.1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H13a4 4 0 0 0 4-4.2C17 5 13.8 3 10 3z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <circle cx="7" cy="8" r="1.1" fill="currentColor" />
        <circle cx="10" cy="6.3" r="1.1" fill="currentColor" />
        <circle cx="13" cy="8" r="1.1" fill="currentColor" />
        <circle cx="6.5" cy="11.5" r="1.1" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 4px 5px 8px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  user-select: none;
}
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item:hover {
  background: var(--chip);
}
.item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.item.active {
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 700;
  box-shadow: var(--glow);
}
.item.active:hover {
  background: var(--accent);
}
.item.active .paint {
  color: var(--accent-contrast);
  opacity: 0.7;
}
.item.active .paint:hover {
  opacity: 1;
  background: rgb(0 0 0 / 0.12);
}
.item.drop {
  box-shadow: inset 0 2px 0 var(--accent);
}
.item.ghosted {
  opacity: 0.4;
}
.paint {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--muted);
  opacity: 0;
  border-radius: 6px;
}
.paint svg {
  width: 15px;
  height: 15px;
}
.item:hover .paint,
.item:focus-within .paint {
  opacity: 1;
}
.paint:hover {
  color: var(--text-strong);
  background: var(--surface);
}
</style>
