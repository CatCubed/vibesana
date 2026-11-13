<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TaskPanel from './task/TaskPanel.vue'
import { useTaskOpener } from '../composables/useTaskOpener'
import { useSettings } from '../composables/useSettings'
import { useLayout } from '../composables/useLayout'
import type { TaskDetail } from '../types'

defineProps<{ gid: string }>()
const emit = defineEmits<{ updated: [task: TaskDetail] }>()

const opener = useTaskOpener()
const settings = useSettings()
const layout = useLayout()
const docked = computed(() => settings.dockedPanel && !layout.split)
const EXPANDED_KEY = 'asana-board:drawer-expanded'
const expanded = ref(readExpanded())

// Opening a task moves keyboard focus into it (so its shortcuts work at once); closing puts focus back.
const drawerEl = ref<HTMLElement | null>(null)
let previous: HTMLElement | null = null
onMounted(() => {
  previous = document.activeElement as HTMLElement | null
  if (!drawerEl.value?.contains(document.activeElement)) drawerEl.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  if (previous?.isConnected && drawerEl.value?.contains(document.activeElement)) previous.focus({ preventScroll: true })
})

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1'
  } catch {
    return false
  }
}

function toggleExpanded(): void {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(EXPANDED_KEY, expanded.value ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}
</script>

<template>
  <div :class="docked ? 'dock' : 'backdrop'" @click.self="docked ? undefined : opener.close()">
    <aside
      ref="drawerEl"
      class="drawer"
      :class="{ expanded, docked }"
      role="dialog"
      :aria-modal="!docked"
      aria-label="Task details"
      tabindex="-1"
    >
      <Transition name="swap" mode="out-in">
      <TaskPanel
        :key="gid"
        :gid="gid"
        :can-go-back="opener.state.stack.length > 1"
        :expanded="expanded"
        @updated="emit('updated', $event)"
        @open="opener.push($event)"
        @back="opener.back()"
        @close="opener.close()"
        @toggle-expand="toggleExpanded"
      />
      </Transition>
    </aside>
  </div>
</template>

<style scoped>
.drawer:focus,
.drawer:focus-visible {
  outline: none;
}
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--backdrop);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  z-index: 10;
}
.drawer {
  width: min(700px, 100%);
  height: 100%;
  background: var(--surface);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  box-shadow: var(--shadow-float);
}
.drawer.expanded {
  width: min(1100px, 100%);
}
.dock {
  flex: none;
  height: 100%;
  display: flex;
  padding: 8px 8px 8px 0;
}
.drawer.docked {
  width: min(620px, 46vw);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-raised);
  overflow: hidden;
}
.drawer.docked.expanded {
  width: min(980px, 62vw);
}
</style>
