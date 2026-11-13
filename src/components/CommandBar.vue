<script setup lang="ts">
import UiIcon from './UiIcon.vue'
import { computed, onMounted, ref, watch } from 'vue'
import * as api from '../api/asana'
import { useCreateTask } from '../composables/useCreateTask'
import { projectColor, useSettings } from '../composables/useSettings'
import { textOn } from '../colors'
import ProjectIcon from './ProjectIcon.vue'
import type { Project, TypeaheadResult } from '../types'

const props = defineProps<{ workspace: string; initial?: string }>()
const emit = defineEmits<{
  close: []
  'open-task': [gid: string]
  'open-project': [project: Project]
  'my-tasks': []
  activity: []
  'sign-out': []
  refresh: []
  hotkeys: []
}>()

interface Place {
  gid: string
  project: string
  section: string | null
  color: string | null
}

type Item =
  | { kind: 'task'; gid: string; label: string; completed: boolean; places: Place[]; parent: string | null }
  | { kind: 'project'; project: Project }
  | { kind: 'action'; id: string; label: string; hint?: string; run: () => void }

const settings = useSettings()
const input = ref<HTMLInputElement | null>(null)
const query = ref(props.initial ?? '')
const items = ref<Item[]>([])
const active = ref(0)
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let favorites: Project[] | null = null

const mode = computed(() => (query.value.startsWith('@') ? 'project' : query.value.startsWith('!') ? 'action' : 'task'))
const term = computed(() => query.value.replace(/^[@!]/, '').trim())

const actions: Item[] = [
  { kind: 'action', id: 'new', label: 'New task', hint: 'Shift+N', run: () => useCreateTask().open() },
  { kind: 'action', id: 'my', label: 'Open My Tasks', run: () => emit('my-tasks') },
  { kind: 'action', id: 'activity', label: 'Open Activity', run: () => emit('activity') },
  { kind: 'action', id: 'theme', label: 'Toggle light / dark theme', run: () => (settings.theme = settings.theme === 'dark' ? 'light' : 'dark') },
  { kind: 'action', id: 'sidebar', label: 'Toggle sidebar', run: () => (settings.sidebarOpen = !settings.sidebarOpen) },
  { kind: 'action', id: 'completed', label: 'Toggle completed tasks', run: () => (settings.showCompleted = !settings.showCompleted) },
  { kind: 'action', id: 'density', label: 'Toggle compact density', run: () => (settings.density = settings.density === 'compact' ? 'comfortable' : 'compact') },
  { kind: 'action', id: 'glow', label: 'Toggle glow', run: () => (settings.glow = !settings.glow) },
  { kind: 'action', id: 'refresh', label: 'Refresh board', run: () => emit('refresh') },
  { kind: 'action', id: 'hotkeys', label: 'Keyboard shortcuts', hint: '?', run: () => emit('hotkeys') },
  { kind: 'action', id: 'signout', label: 'Sign out', run: () => emit('sign-out') },
]

let searchRun = 0
const failed = ref<string | null>(null)

async function search(): Promise<void> {
  const q = term.value
  // Answers can arrive out of order; only the newest search may fill the list.
  const run = ++searchRun
  const fresh = (): boolean => run === searchRun
  busy.value = true
  try {
    if (mode.value === 'action') {
      items.value = actions.filter((a) => a.kind === 'action' && a.label.toLowerCase().includes(q.toLowerCase()))
    } else if (mode.value === 'project') {
      let list: Project[]
      if (q) list = await api.searchProjects(props.workspace, q)
      else list = favorites ?? (favorites = await api.favoriteProjects(props.workspace))
      if (!fresh()) return
      items.value = list.map((project) => ({ kind: 'project', project }))
    } else if (q) {
      const found: TypeaheadResult[] = await api.typeahead(props.workspace, 'task', q)
      if (!fresh()) return
      items.value = found.map((t) => ({
        kind: 'task',
        gid: t.gid,
        label: t.name,
        completed: Boolean(t.completed),
        parent: t.parent?.name ?? null,
        places: (t.memberships ?? []).map((m) => ({
          gid: m.project.gid,
          project: m.project.name,
          section: m.section?.name ?? null,
          color: projectColor(m.project),
        })),
      }))
    } else {
      items.value = []
    }
    active.value = 0
    failed.value = null
  } catch (e) {
    if (!fresh()) return
    items.value = []
    failed.value = (e as Error).message
  } finally {
    if (fresh()) busy.value = false
  }
}

watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, mode.value === 'action' ? 0 : 160)
})
onMounted(() => {
  input.value?.focus()
  if (query.value) void search()
})

function choose(item: Item): void {
  if (item.kind === 'task') emit('open-task', item.gid)
  else if (item.kind === 'project') emit('open-project', item.project)
  else item.run()
  emit('close')
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(active.value + 1, items.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (event.key === 'Enter') {
    const item = items.value[active.value]
    if (item) choose(item)
  } else if (event.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <div class="backdrop" @mousedown.self="emit('close')">
    <div class="bar panel">
      <div class="field">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input ref="input" v-model="query" placeholder="Search tasks  ·  @project  ·  !action" @keydown="onKey" />
        <span v-if="busy" class="spin"><UiIcon name="refresh" :size="15" /></span>
      </div>

      <ul v-if="items.length" class="results">
        <li
          v-for="(item, index) in items"
          :key="item.kind === 'task' ? item.gid : item.kind === 'project' ? item.project.gid : item.id"
          :class="{ active: index === active }"
          @mouseenter="active = index"
          @mousedown.prevent="choose(item)"
        >
          <template v-if="item.kind === 'task'">
            <span class="state" :class="{ done: item.completed }" :title="item.completed ? 'Completed task' : 'Task'">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="7" :fill="item.completed ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" />
                <path d="M6.8 10.2l2.2 2.2 4.4-4.6" fill="none" :stroke="item.completed ? 'var(--surface)' : 'currentColor'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="label">{{ item.label }}</span>
            <span v-if="item.places.length" class="places">
              <span v-for="place in item.places.slice(0, 2)" :key="place.gid" class="place">
                <span
                  class="project"
                  :style="place.color ? { background: place.color, color: textOn(place.color) } : undefined"
                >
                  {{ place.project }}
                </span>
                <span v-if="place.section" class="section">{{ place.section }}</span>
              </span>
              <span v-if="item.places.length > 2" class="section">+{{ item.places.length - 2 }}</span>
            </span>
            <span v-else-if="item.parent" class="places">
              <span class="section" :title="item.parent">↳ {{ item.parent }}</span>
            </span>

          </template>
          <template v-else-if="item.kind === 'project'">
            <ProjectIcon :project="item.project" :size="20" />
            <span class="label">{{ item.project.name }}</span>
          </template>
          <template v-else>
            <span class="state" title="Action">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M11 2.5L4.5 11.5h4.5l-1 6 6.5-9H10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="label">{{ item.label }}</span>
            <kbd v-if="item.hint" class="hint">{{ item.hint }}</kbd>
          </template>
        </li>
      </ul>
      <p v-else-if="failed && !busy" class="empty">Search failed: {{ failed }}</p>
      <p v-else-if="term && !busy" class="empty">No matches</p>

      <footer>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
        <span class="legend">@ projects · ! actions · plain text searches tasks</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--backdrop);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}
.bar {
  width: min(680px, calc(100% - 32px));
  border: 1px solid var(--border);
  box-shadow: var(--shadow-float), var(--glow);
  overflow: hidden;
}
.field {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
}
.field svg {
  width: 20px;
  height: 20px;
  color: var(--muted);
}
.field input {
  flex: 1;
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-strong);
}
.field input:focus {
  box-shadow: none;
}
.spin {
  color: var(--muted);
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.results {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 50vh;
  overflow-y: auto;
  border-top: 1px solid var(--border);
}
.results li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
}
.results li.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.state {
  flex: none;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.state svg {
  width: 18px;
  height: 18px;
}
.results li.active .state {
  color: var(--accent);
}
.hint {
  flex: none;
  margin: 0;
  font-weight: 700;
  color: var(--muted);
}
.state.done {
  color: var(--ok);
}
.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.places {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 55%;
  min-width: 0;
  font-size: 12px;
}
.place {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.project {
  flex: none;
  font-size: 11px;
  font-weight: 800;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--chip);
  color: var(--text);
}
.section {
  color: var(--muted);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kind {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.empty {
  margin: 0;
  padding: 14px 18px;
  color: var(--muted);
  border-top: 1px solid var(--border);
}
footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
kbd {
  font: 700 11px var(--font);
  font-size-adjust: var(--font-adjust);
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  padding: 1px 6px;
  margin-right: 4px;
}
.legend {
  margin-left: auto;
  font-weight: 600;
}
</style>
